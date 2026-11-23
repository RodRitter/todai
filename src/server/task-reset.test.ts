import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";

test("reset clears task history and references while preserving task identity and shared artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-reset-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  const artifacts = new ArtifactStore(path, store.workspaceId);
  const db = new DatabaseSync(path);
  try {
    const board = store.saveBoard("Other board");
    const original = store.save({ id: "one", title: "Keep title", description: "Keep description", boardId: board.id, status: "Done", autoRun: true, autoWorkflow: true });
    store.save({ id: "two", title: "Other task", description: "", status: "To do" });
    const artifact = artifacts.create({ title: "Shared", type: "markdown", creator: "Human", description: "", content: "Saved content" });
    for (const taskId of ["one", "two"]) {
      store.postComment(taskId, "Comment", [{ artifactId: artifact.id, revisionId: artifact.revisionId }]);
      artifacts.linkTask(taskId, artifact.id);
      db.prepare("INSERT INTO chat_sessions (id, workspaceId, taskId, createdAt, updatedAt) VALUES (?, ?, ?, 'now', 'now')").run(taskId, store.workspaceId, taskId);
      db.prepare("INSERT INTO chat_messages (id, sessionId, authorName, body, createdAt) VALUES (?, ?, 'Human', 'Chat', 'now')").run(taskId, taskId);
      db.prepare("INSERT INTO runs (id, workspaceId, taskId, column, profile, status, createdAt) VALUES (?, ?, ?, 'Done', '{}', 'Complete', 'now')").run(taskId, store.workspaceId, taskId);
      db.prepare("INSERT INTO task_usage (id, workspaceId, taskId, agentName, model, kind, startedAt, outcome) VALUES (?, ?, ?, 'Agent', 'model', 'task', 'now', 'Complete')").run(taskId, store.workspaceId, taskId);
    }
    const parent = store.list().find(task => task.id === "one")!.comments![0];
    store.postComment("one", "Reply", [], parent.id);
    db.prepare("UPDATE artifact_revisions SET taskId = 'one', runId = 'one'").run();
    store.reset("one");
    store.close();
    store = new TaskStore(path);
    const reset = store.list().find(task => task.id === "one")!;
    assert.equal(reset.title, original.title);
    assert.equal(reset.description, original.description);
    assert.equal(reset.taskNumber, original.taskNumber);
    assert.equal(reset.boardId, board.id);
    assert.equal(reset.status, board.columns[0]);
    assert.equal(reset.agentStatus, "Not started");
    assert.equal(reset.autoRun, false);
    assert.equal(reset.autoWorkflow, false);
    assert.deepEqual(reset.comments, []);
    for (const table of ["comments", "chat_sessions", "runs", "task_usage", "task_artifacts"])
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE taskId = 'one'`).get()!.n, 0, table);
    assert.equal(db.prepare("SELECT count(*) AS n FROM chat_messages WHERE sessionId = 'one'").get()!.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM comment_artifacts").get()!.n, 1);
    assert.equal(db.prepare("SELECT taskId FROM artifact_revisions").get()!.taskId, null);
    assert.equal(artifacts.read(artifact.id).title, "Shared");
    assert.equal(store.list().find(task => task.id === "two")!.comments!.length, 1);
    assert.equal(store.history("two").length, 1);
    assert.equal(artifacts.forTask("two").length, 1);
  } finally {
    db.close(); artifacts.close(); store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reset rejects active work and foreign or missing tasks without deleting comments", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-reset-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  const db = new DatabaseSync(path);
  try {
    store.save({ id: "one", title: "Task", description: "", status: "Done" });
    store.postComment("one", "Keep this comment");
    db.prepare("INSERT INTO runs (id, workspaceId, taskId, column, profile, status, createdAt) VALUES ('run', ?, 'one', 'Done', '{}', 'Queued', 'now')").run(store.workspaceId);
    for (const status of ["Queued", "Running"]) {
      db.prepare("UPDATE runs SET status = ?").run(status);
      assert.throws(() => store.reset("one"), /finish before resetting/);
    }
    db.prepare("DELETE FROM runs").run();
    db.prepare("INSERT INTO chat_sessions (id, workspaceId, taskId, createdAt, updatedAt, lease) VALUES ('chat', ?, 'one', 'now', 'now', ?)").run(store.workspaceId, new Date(Date.now() + 60000).toISOString());
    assert.throws(() => store.reset("one"), /chat response/);
    const workspace = store.createWorkspace("Other", directory);
    const other = new TaskStore(path, workspace.id);
    try { assert.throws(() => other.reset("one"), /another workspace/); }
    finally { other.close(); }
    assert.throws(() => store.reset("missing"), /no longer exists/);
    assert.throws(() => store.reset(null), /Choose a task/);
    assert.equal(store.list()[0].comments!.length, 1);
    assert.equal(store.list()[0].status, "Done");
  } finally { db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});
