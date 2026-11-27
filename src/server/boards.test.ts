import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrateBoards } from "./board-schema.ts";
import { parseConfiguration, selectConfiguration } from "../domain/configuration.ts";
import { TaskStore } from "./task-store.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-boards-"));
  const path = join(directory, "tasks.sqlite");
  const first = new TaskStore(path);
  const board = first.saveBoard("Product");
  const second = new TaskStore(path, first.workspaceId, { boardId: board.id });
  return { first, second, path, cleanup() { first.close(); second.close(); rmSync(directory, { recursive: true, force: true }); } };
}
const draft = { id: "one", title: "Work", description: "", status: "To do" };
const agent = { id: "agent", name: "Builder", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "read-only" };

test("boards isolate same-named columns, tasks and assignments while sharing agents across restart", () => {
  const f = fixture();
  try {
    f.first.saveAgent(agent);
    f.first.assignColumnAgent({ column: "To do", agentId: agent.id });
    f.second.assignColumnAgent({ column: "To do", agentId: agent.id });
    const original = f.first.save(draft);
    const other = f.second.save({ ...draft, id: "two", autoRun: true });
    f.second.renameColumn("To do", "Backlog");
    assert.deepEqual(f.first.boardSnapshot().tasks, [original]);
    assert.equal(f.second.boardSnapshot().tasks[0].status, "Backlog");
    assert.equal(f.second.history(other.id)[0].column, "Backlog");
    assert.deepEqual(f.first.listColumnAgents(), [{ column: "To do", agentId: agent.id }]);
    assert.deepEqual(f.first.listAgents(), f.second.listAgents());
    const reopened = new TaskStore(f.path, f.first.workspaceId, { boardId: f.second.boardId });
    try { assert.equal(reopened.listColumns()[0], "Backlog"); assert.equal(reopened.boardSnapshot().tasks.length, 1); }
    finally { reopened.close(); }
    f.first.deleteAgent(agent.id);
    assert.deepEqual(f.second.listColumnAgents(), []);
  } finally { f.cleanup(); }
});

test("moving tasks validates destination columns, preserves comments, and protects occupied boards and active work", () => {
  const f = fixture();
  try {
    const task = f.first.save(draft);
    f.first.addComment({ id: "comment", taskId: task.id, body: "Keep context", createdAt: new Date().toISOString() });
    f.second.renameColumn("To do", "Backlog");
    assert.throws(() => f.first.save({ ...task, boardId: f.second.boardId }), /valid task/);
    const moved = f.first.save({ ...task, boardId: f.second.boardId, status: "Backlog" });
    assert.equal(moved.comments?.[0].body, "Keep context");
    assert.equal(f.first.boardSnapshot().tasks.length, 0);
    assert.throws(() => f.first.deleteBoard(f.second.boardId), /Move all tasks/);
    f.second.saveAgent(agent);
    f.second.assignColumnAgent({ column: "Backlog", agentId: agent.id });
    // A scheduler/default-board connection must use the task's board assignment.
    f.first.runTask(task.id);
    assert.equal(f.first.history(task.id)[0].profile.id, agent.id);
    assert.throws(() => f.first.save({ ...moved, boardId: f.first.boardId, status: "To do" }), /finish/);
    f.first.stopTask(task.id);
    f.first.save({ ...moved, boardId: f.first.boardId, status: "To do" });
    f.first.deleteBoard(f.second.boardId);
    assert.equal(f.first.listBoards().length, 1);
    assert.equal(f.first.listAgents().length, 1);
    assert.throws(() => new TaskStore(f.path, f.first.workspaceId, { boardId: f.second.boardId }), /existing board/);
  } finally { f.cleanup(); }
});

test("board names, workspace ownership and configuration replacement preserve boundaries", () => {
  const f = fixture();
  try {
    assert.throws(() => f.first.saveBoard(" product "), /already exists/);
    assert.throws(() => f.first.saveBoard(" "), /name/);
    const workspace = f.first.createWorkspace("Other", tmpdir());
    assert.throws(() => f.first.save({ ...draft, boardId: workspace.id }), /existing board/);
    f.first.save(draft);
    f.second.save({ ...draft, id: "two" });
    f.second.importConfiguration({ format: "todai-configuration", version: 1, agents: [], columns: [{ id: "new", name: "Ready" }], assignments: [] }, "replace");
    assert.equal(f.first.boardSnapshot().tasks[0].status, "To do");
    assert.equal(f.second.boardSnapshot().tasks[0].status, "Ready");
    assert.equal(f.first.listColumns()[0], "To do");
  } finally { f.cleanup(); }
});

test("automatic workflow follows the task board's columns from a default-board scheduler", () => {
  const f = fixture();
  try {
    f.second.renameColumn("In progress", "Build");
    f.second.saveAgent(agent);
    f.second.assignColumnAgent({ column: "To do", agentId: agent.id });
    f.second.assignColumnAgent({ column: "Build", agentId: agent.id });
    f.second.save({ ...draft, autoWorkflow: true, autoRun: true });
    const run = f.first.claimRun()!;
    f.first.finishRun(run.id, "Complete", "Planned");
    assert.equal(f.second.boardSnapshot().tasks[0].status, "Build");
    assert.equal(f.first.history(draft.id)[1].column, "Build");
  } finally { f.cleanup(); }
});

test("board order persists, appends new boards, and rejects incomplete or foreign orders", () => {
  const f = fixture();
  try {
    const ids = [f.second.boardId, f.first.boardId];
    assert.deepEqual(f.first.reorderBoards(ids).map((board) => board.id), ids);
    const reopened = new TaskStore(f.path);
    try { assert.deepEqual(reopened.listBoards().map((board) => board.id), ids); }
    finally { reopened.close(); }
    for (const invalid of [null, [], [ids[0], ids[0]], [ids[0], "foreign"]])
      assert.throws(() => f.first.reorderBoards(invalid), /each board/);
    assert.deepEqual(f.first.listBoards().map((board) => board.id), ids);
    const added = f.first.saveBoard("Last");
    assert.deepEqual(f.first.listBoards().map((board) => board.id), [...ids, added.id]);
  } finally { f.cleanup(); }
});

test("board exports omit board order and board imports do not reorder the workspace", () => {
  const f = fixture();
  try {
    const ids = [f.second.boardId, f.first.boardId];
    f.first.reorderBoards(ids);
    const exported = f.first.exportConfiguration();
    assert.equal(exported.boardOrder, undefined);
    assert.equal(exported.boards, undefined);
    const legacy = { ...exported, boardOrder: [{ id: f.first.boardId, name: "Board" }, { id: f.second.boardId, name: "Product" }] };
    assert.equal(selectConfiguration(parseConfiguration(legacy), [], []).boardOrder, undefined);
    f.first.importConfiguration(legacy);
    assert.deepEqual(f.first.listBoards().map((board) => board.id), ids);
    const workspace = f.first.exportConfiguration(true);
    assert.equal(workspace.boardOrder, undefined);
    assert.deepEqual(workspace.boards?.map((board) => board.id), ids);
  } finally { f.cleanup(); }
});

test("board position migration preserves the existing order and is safe to repeat", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE workspaces (id TEXT PRIMARY KEY); CREATE TABLE tasks (boardId TEXT); CREATE TABLE boards (id TEXT PRIMARY KEY, workspaceId TEXT, name TEXT); INSERT INTO boards VALUES ('b', 'w', 'Second'), ('a', 'w', 'First');");
    migrateBoards(db);
    assert.deepEqual(db.prepare("SELECT id FROM boards ORDER BY position").all().map((row) => row.id), ["b", "a"]);
    db.exec("UPDATE boards SET position = 0 WHERE id = 'a'");
    migrateBoards(db);
    assert.deepEqual(db.prepare("SELECT id FROM boards ORDER BY position").all().map((row) => row.id), ["a", "b"]);
  } finally { db.close(); }
});
