import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";
import { DELETE } from "../app/api/workspaces/route.ts";

test("permanent workspace deletion removes owned records, preserves other workspaces and project files, and rolls back failures", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-delete-workspace-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  const db = new DatabaseSync(path);
  const artifacts = new ArtifactStore(path, store.workspaceId);
  try {
    const id = store.workspaceId;
    store.setWorkspacePath(directory);
    writeFileSync(join(directory, "project.txt"), "Keep project files");
    const other = store.createWorkspace("Keep", directory);
    store.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "workspace-write" });
    store.assignColumnAgent({ column: "To do", agentId: "agent" });
    store.save({ id: "task", title: "Delete", description: "", status: "To do", autoRun: true });
    const run = store.claimRun()!;
    store.finishRun(run.id, "Complete", "Finished");
    store.postComment("task", "A comment");
    artifacts.create({ title: "Document", type: "link", creator: "User", description: "", url: "https://example.com" });
    db.prepare("INSERT INTO memory_versions VALUES (?, 'entry', 1, '{}', 'test')").run(id);
    db.prepare("INSERT INTO workspace_chats (id, workspaceId, title, tool, model, createdAt, updatedAt) VALUES ('chat', ?, 'Chat', 'codex', 'test', '', '')").run(id);
    db.exec("INSERT INTO workspace_chat_messages (id, sessionId, authorRole, authorName, body, createdAt) VALUES ('message', 'chat', 'user', 'User', 'Hello', '')");
    assert.throws(() => store.deleteArchivedWorkspace(id), /Archive/);
    store.setWorkspaceArchived(id, true);
    db.prepare("UPDATE runs SET status = 'Queued' WHERE id = ?").run(run.id);
    assert.throws(() => store.deleteArchivedWorkspace(id), /queued and running/);
    db.prepare("UPDATE runs SET status = 'Running' WHERE id = ?").run(run.id);
    assert.throws(() => store.deleteArchivedWorkspace(id), /queued and running/);
    db.prepare("UPDATE runs SET status = 'Complete' WHERE id = ?").run(run.id);
    db.prepare("INSERT INTO chat_sessions (id, workspaceId, taskId, createdAt, updatedAt, lease) VALUES ('task-chat', ?, 'task', '', '', ?)").run(id, new Date(Date.now() + 60_000).toISOString());
    assert.throws(() => store.deleteArchivedWorkspace(id), /chats/);
    db.exec("UPDATE chat_sessions SET lease = NULL");
    db.exec("CREATE TRIGGER reject_workspace_delete BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    assert.throws(() => store.deleteArchivedWorkspace(id), /test failure/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM tasks WHERE workspaceId = ?").get(id)?.n, 1);
    db.exec("DROP TRIGGER reject_workspace_delete");
    store.deleteArchivedWorkspace(id);
    assert.deepEqual(store.listArchivedWorkspaces(), []);
    assert.deepEqual(store.listWorkspaces().map(workspace => ({ ...workspace })), [other]);
    for (const row of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
      const table = String(row.name);
      if (db.prepare(`PRAGMA table_info("${table}")`).all().some(column => column.name === "workspaceId")) {
        assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE workspaceId = ?`).get(id)?.n, 0, table);
      }
    }
    assert.equal(db.prepare("SELECT count(*) AS n FROM workspace_chat_messages").get()?.n, 0);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(readFileSync(join(directory, "project.txt"), "utf8"), "Keep project files");
    assert.throws(() => store.deleteArchivedWorkspace(id), /existing/);
  } finally { artifacts.close(); db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("workspace delete API validates input and blocks active work before deleting the last archived workspace", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-delete-api-"));
  const previous = process.env.TODAI_DB_PATH;
  const path = join(directory, "tasks.sqlite");
  process.env.TODAI_DB_PATH = path;
  const store = new TaskStore(path);
  const db = new DatabaseSync(path);
  const request = (body: unknown) => new Request("http://localhost/api/workspaces", { method: "DELETE", body: JSON.stringify(body) });
  try {
    const id = store.workspaceId;
    assert.equal((await DELETE(request({}))).status, 400);
    assert.equal((await DELETE(request({ id }))).status, 409);
    store.setWorkspaceArchived(id, true);
    db.prepare("INSERT INTO workspace_chats (id, workspaceId, title, tool, model, createdAt, updatedAt, lease) VALUES ('chat', ?, 'Chat', 'codex', 'test', '', '', ?)").run(id, new Date(Date.now() + 60_000).toISOString());
    assert.equal((await DELETE(request({ id }))).status, 409);
    db.exec("UPDATE workspace_chats SET lease = NULL");
    const response = await DELETE(request({ id }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { archived: [] });
    assert.equal((await DELETE(request({ id }))).status, 409);
  } finally {
    db.close(); store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
