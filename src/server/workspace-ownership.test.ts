import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { withTaskStore } from "./database.ts";
import { TaskStore } from "./task-store.ts";

test("legacy board and queued history acquire a stable initial workspace on repeated startup", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-ownership-"));
  const path = join(directory, "tasks.sqlite");
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO settings VALUES ('workspacePath', '/projects/legacy'), ('defaultExecutor', 'claude');
    CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, tool TEXT NOT NULL, model TEXT NOT NULL, effort TEXT NOT NULL, instructions TEXT NOT NULL, permissions TEXT NOT NULL);
    INSERT INTO agents VALUES ('agent', 'Builder', 'codex', 'test', 'medium', 'Preserve instructions', 'workspace-write');
    CREATE TABLE column_assignments (column TEXT PRIMARY KEY, agentId TEXT NOT NULL REFERENCES agents(id));
    INSERT INTO column_assignments VALUES ('To do', 'agent');
    CREATE TABLE comments (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO comments VALUES ('comment', 'legacy', 'Previous handover', '2026-11-16T00:00:00Z');
    CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, agentStatus TEXT NOT NULL);
    INSERT INTO tasks VALUES ('legacy', 'Keep history', 'Description', 'To do', 'Queued');
    CREATE TABLE runs (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, column TEXT NOT NULL, profile TEXT NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL, startedAt TEXT, finishedAt TEXT, summary TEXT, ownerPid INTEGER, runnerPid INTEGER);
    INSERT INTO runs VALUES ('queued', 'legacy', 'To do', '{"id":"agent","name":"Agent"}', 'Queued', '2026-11-17T00:00:00Z', NULL, NULL, NULL, NULL, NULL);
  `);
  legacy.close();
  let store = new TaskStore(path);
  try {
    const workspace = store.getWorkspace();
    assert.equal(workspace.name, "legacy");
    assert.equal(workspace.path, "/projects/legacy");
    assert.equal(store.getDefaultExecutor(), "claude");
    assert.equal(store.list()[0].title, "Keep history");
    assert.equal(store.list()[0].comments?.[0].body, "Previous handover");
    assert.equal(store.listAgents()[0].instructions, "Preserve instructions");
    assert.deepEqual(store.listColumnAgents(), [{ column: "To do", agentId: "agent" }]);
    assert.equal(store.history()[0].workspaceId, workspace.id);
    assert.equal(store.history()[0].workspacePath, "/projects/legacy");
    store.close();
    store = new TaskStore(path, workspace.id);
    assert.deepEqual(store.getWorkspace(), workspace);
    assert.equal(store.listWorkspaces().length, 1);
    assert.equal(store.history().length, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("workspace stores isolate boards, profiles, assignments, settings and reject foreign IDs", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-isolation-"));
  const path = join(directory, "tasks.sqlite");
  const first = new TaskStore(path);
  let second: TaskStore | undefined;
  try {
    const workspace = first.createWorkspace("Second", directory);
    second = new TaskStore(path, workspace.id);
    first.saveAgent({ id: "first-agent", name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "workspace-write" });
    first.assignColumnAgent({ column: "To do", agentId: "first-agent" });
    first.setDefaultExecutor("claude");
    const task = first.save({ id: "first-task", title: "First", description: "", status: "To do", autoRun: true });
    assert.deepEqual(second.list(), []);
    assert.deepEqual(second.listAgents(), []);
    assert.deepEqual(second.listColumnAgents(), []);
    assert.equal(second.getDefaultExecutor(), "codex");
    assert.deepEqual(second.listColumns(), first.listColumns());
    assert.throws(() => second!.save(task), /workspace/i);
    assert.throws(() => second!.saveAgent(first.listAgents()[0]), /workspace/i);
    assert.throws(() => second!.assignColumnAgent({ column: "To do", agentId: "first-agent" }));
    assert.throws(() => second!.history(task.id), /workspace/i);
    assert.throws(() => second!.delete(task.id), /workspace/i);
    assert.throws(() => second!.deleteAgent("first-agent"), /workspace/i);
    assert.throws(() => second!.finishRun(first.history()[0].id, "Complete", "Wrong workspace"), /workspace/i);
    second.renameColumn("To do", "Ready");
    assert.equal(first.listColumns()[0], "To do");
    assert.equal(first.list()[0].status, "To do");
    assert.equal(first.listColumnAgents()[0].column, "To do");
    assert.throws(() => new TaskStore(path, "missing"), /workspace/i);
  } finally {
    second?.close();
    first.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("configuration replacement and comments stay in their workspace", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-config-isolation-"));
  const path = join(directory, "tasks.sqlite");
  const first = new TaskStore(path);
  const second = new TaskStore(path, first.createWorkspace("Second", directory).id);
  try {
    first.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "workspace-write" });
    first.assignColumnAgent({ column: "To do", agentId: "agent" });
    first.save({ id: "one", title: "First", description: "", status: "To do" });
    first.postComment("one", "Keep this conversation");
    second.save({ id: "two", title: "Second", description: "", status: "To do" });
    const original = first.exportConfiguration();
    const board = first.boardSnapshot();
    assert.throws(() => second.importConfiguration(original, "replace", "overwrite"), /workspace/i);
    assert.throws(() => second.postComment("one", "Wrong board"), /workspace/i);
    assert.throws(() => second.addComment({ id: "bad", taskId: "one", body: "Wrong board", createdAt: new Date().toISOString() }), /workspace/i);
    second.importConfiguration(original, "replace", "copy");
    assert.deepEqual(first.exportConfiguration(), original);
    assert.deepEqual(first.boardSnapshot(), board);
    assert.notEqual(second.listAgents()[0].id, "agent");
    second.renameColumn("To do", "Ready");
    assert.equal(second.list()[0].status, "Ready");
    assert.equal(first.list()[0].status, "To do");
  } finally {
    first.close(); second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("execution is globally serial across workspace stores and uses each captured directory", async () => {
  const { ExecutionService } = await import("./execution-service.ts");
  const directory = mkdtempSync(join(tmpdir(), "todai-global-queue-"));
  const path = join(directory, "tasks.sqlite");
  const first = new TaskStore(path);
  first.setWorkspacePath(directory);
  const second = new TaskStore(path, first.createWorkspace("Second", tmpdir()).id);
  const seen: { workspaceId: string; workspace: string }[] = [];
  let release: (() => void) | undefined;
  let draining: Promise<void> | undefined;
  try {
    for (const [index, store] of [first, second].entries()) {
      store.saveAgent({ id: `agent-${index}`, name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "workspace-write" });
      store.assignColumnAgent({ column: "To do", agentId: `agent-${index}` });
      store.save({ id: `task-${index}`, title: "Work", description: "", status: "To do", autoRun: true });
    }
    const firstService = new ExecutionService(first, async ({ run, workspace }) => {
      seen.push({ workspaceId: run.workspaceId, workspace });
      await new Promise<void>((resolve) => { release = resolve; });
      return "First done";
    });
    const secondService = new ExecutionService(second, async ({ run, workspace }) => {
      seen.push({ workspaceId: run.workspaceId, workspace });
      return "Second done";
    });
    draining = firstService.drain();
    await secondService.drain();
    assert.equal(seen.length, 1);
    assert.equal(second.history()[0].status, "Queued");
    assert.throws(() => second!.setWorkspacePath(directory), /running/i);
    release!();
    await draining;
    await secondService.drain();
    assert.deepEqual(seen, [
      { workspaceId: first.workspaceId, workspace: realpathSync(directory) },
      { workspaceId: second.workspaceId, workspace: realpathSync(tmpdir()) },
    ]);
    assert.notEqual(seen[1].workspace, directory);
    assert.equal(first.list()[0].comments?.[0].body, "First done");
    assert.equal(second.list()[0].comments?.[0].body, "Second done");
  } finally {
    release?.(); await draining;
    first.close(); second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});


test("request-bound stores require explicit ownership and cannot mutate another workspace", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-request-ownership-"));
  const path = join(directory, "tasks.sqlite");
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = path;
  const store = new TaskStore(path);
  try {
    const second = store.createWorkspace("Second", directory);
    const task = store.save({ id: "one", title: "Original", description: "", status: "To do" });
    const request = (id?: string) => new Request("http://localhost/api/tasks", {
      headers: id ? { "X-Todai-Workspace": id } : {},
    });
    assert.throws(() => withTaskStore(request(), (target) => target.list()), /workspace ID/i);
    assert.throws(() => withTaskStore(request("missing"), (target) => target.list()), /workspace/i);
    assert.deepEqual(withTaskStore(request(second.id), (target) => target.list()), []);
    assert.throws(() => withTaskStore(request(second.id), (target) => target.save({ ...task, title: "Wrong" })), /workspace/i);
    assert.equal(withTaskStore(request(store.workspaceId), (target) => target.list())[0].title, "Original");
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("startup repairs missing comment ownership in an already migrated database", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-comment-migration-"));
  const path = join(directory, "tasks.sqlite");
  const first = new TaskStore(path);
  const firstId = first.workspaceId;
  const secondId = first.createWorkspace("Second", directory).id;
  const second = new TaskStore(path, secondId);
  for (const [id, store] of [["one", first], ["two", second]] as const) {
    store.save({ id, title: id, description: "", status: "To do" });
    store.postComment(id, `Conversation ${id}`);
  }
  first.close(); second.close();
  const legacy = new DatabaseSync(path);
  legacy.exec("DROP INDEX comments_workspace; ALTER TABLE comments DROP COLUMN workspaceId;");
  legacy.close();
  try {
    for (let startup = 0; startup < 2; startup++) {
      for (const [id, workspaceId] of [["one", firstId], ["two", secondId]]) {
        const store = new TaskStore(path, workspaceId);
        try {
          assert.equal(store.list()[0].comments?.[0].body, `Conversation ${id}`);
          assert.equal(store.listWorkspaces().length, 2);
          assert.equal(store.history().length, 0);
        } finally { store.close(); }
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
