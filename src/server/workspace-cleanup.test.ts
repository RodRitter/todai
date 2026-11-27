import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { initializeCleanupSchema } from "./cleanup-schema.ts";
import { previewCleanup } from "./workspace-cleanup.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-cleanup-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  const old = "2020-01-01T00:00:00.000Z";
  function task(id: string, description = "", archived = true) {
    store.save({ id, title: id, description, status: "Done" });
    if (archived) db.prepare("UPDATE tasks SET archivedAt = ? WHERE id = ?").run(old, id);
  }
  function artifact(id: string, content = "", taskId: string | null = null, archived = true) {
    db.prepare(`INSERT INTO artifacts(id, workspaceId, title, description, type, creator, createdAt, updatedAt, content, archived, taskId)
      VALUES (?, ?, ?, '', 'markdown', 'Human', ?, ?, ?, ?, ?)`).run(id, store.workspaceId, id, old, old, Buffer.from(content), Number(archived), taskId);
    if (archived) db.prepare("UPDATE artifacts SET archivedAt = ? WHERE id = ?").run(old, id);
  }
  function memory(id: string, source: string, retired = false) {
    db.prepare(`INSERT INTO memory_entries(id,workspaceId,revision,category,title,statement,scope,source,updatedAt,removed)
      VALUES (?, ?, 1, 'Terms', ?, 'Fact', '', ?, ?, ?)`).run(id, store.workspaceId, id, source, old, Number(retired));
    if (retired) db.prepare("UPDATE memory_entries SET retiredAt = ? WHERE id = ?").run(old, id);
  }
  return { store, db, task, artifact, memory, old, directory, close() { db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); } };
}
const ids = (preview: ReturnType<TaskStore["previewCleanup"]>) => preview.remove.map(row => row.id).sort();

test("cleanup removes isolated cycles, dependent history, and retired memory versions", () => {
  const f = fixture();
  try {
    f.task("one", "[two](#task/two)"); f.task("two", "[one](#task/one)");
    f.artifact("document", "[one](#task/one)", "one");
    f.db.prepare("INSERT INTO task_artifacts VALUES ('one', 'document')").run();
    f.memory("retired", "[one](#task/one)", true);
    f.db.prepare("INSERT INTO memory_versions VALUES (?, 'retired', 1, ?, 'Previous')").run(f.store.workspaceId, JSON.stringify({ source: "#task/one" }));
    f.db.prepare("INSERT INTO comments (id,taskId,workspaceId,body,createdAt) VALUES ('comment','one',?,'History',?)").run(f.store.workspaceId, f.old);
    const number = f.db.prepare("SELECT number FROM task_numbers WHERE taskId = 'one'").get()!.number;
    const preview = f.store.previewCleanup(90);
    assert.deepEqual(ids(preview), ["document", "one", "retired", "two"]);
    f.store.executeCleanup(preview);
    assert.equal(f.db.prepare("SELECT count(*) n FROM comments").get()!.n, 0);
    assert.equal(f.db.prepare("SELECT count(*) n FROM memory_versions").get()!.n, 0);
    assert.equal(f.db.prepare("SELECT taskId FROM task_numbers WHERE number = ?").get(number)!.taskId, null);
    assert.deepEqual(ids(f.store.previewCleanup(90)), []);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(f.db.prepare("SELECT count(*) n FROM memory_search WHERE memory_search MATCH 'Fact'").get()!.n, 0);
  } finally { f.close(); }
});

test("active memory protects evidence chains and artifact text protects tasks", () => {
  const f = fixture();
  try {
    f.artifact("document", "[other](#task/other)"); f.task("other");
    f.task("evidence", "[document](#artifact/document/old-revision)");
    f.memory("knowledge", "[evidence](/?workspace=w&task=evidence)");
    assert.deepEqual(ids(f.store.previewCleanup(90)), []);
  } finally { f.close(); }
});

test("retained comments, chats, history and cross-workspace references protect archives", () => {
  const f = fixture();
  try {
    for (const id of ["comment-source", "chat-source", "version-source", "legacy-source", "external-source"]) f.task(id);
    f.task("active", "[comment](#comment/comment-source/comment-id)", false);
    f.db.prepare("INSERT INTO workspace_chats(id,workspaceId,title,tool,model,createdAt,updatedAt) VALUES ('chat',?,'Chat','codex','model',?,?)").run(f.store.workspaceId, f.old, f.old);
    f.db.prepare("INSERT INTO workspace_chat_messages(id,sessionId,authorRole,authorName,body,createdAt) VALUES ('msg','chat','user','Human','[chat-source](#task/chat-source)',?)").run(f.old);
    f.memory("active-memory", "");
    f.db.prepare("INSERT INTO memory_versions VALUES (?, 'active-memory', 1, ?, 'Previous')").run(f.store.workspaceId, JSON.stringify({ source: "#task/version-source" }));
    f.db.prepare("INSERT INTO workspace_memory VALUES (?, 1, '', 'legacy-source', ?)").run(f.store.workspaceId, f.old);
    const other = f.store.createWorkspace("Other", f.directory);
    f.db.prepare("INSERT INTO tasks(id,workspaceId,boardId,title,description,status,agentStatus) VALUES ('external',?,?,'External','[link](#task/external-source)','Done','Not started')").run(other.id, other.id);
    f.db.prepare("UPDATE workspaces SET archived = 1 WHERE id = ?").run(other.id);
    assert.deepEqual(ids(f.store.previewCleanup(90)), []);
  } finally { f.close(); }
});

test("retention boundaries, worktrees, and unknown dates prevent removal", () => {
  const f = fixture();
  try {
    for (const id of ["boundary", "older", "tree"]) f.task(id);
    const now = new Date().toISOString(); const boundary = Date.parse(now) - 90 * 86400000;
    f.db.prepare("UPDATE tasks SET archivedAt = ? WHERE id = 'boundary'").run(new Date(boundary).toISOString());
    f.db.prepare("UPDATE tasks SET archivedAt = ? WHERE id = 'older'").run(new Date(boundary - 1).toISOString());
    f.db.prepare("UPDATE tasks SET worktree = '{}' WHERE id = 'tree'").run();
    f.artifact("unknown"); f.db.prepare("UPDATE artifacts SET archivedAt = NULL WHERE id = 'unknown'").run();
    assert.deepEqual(ids(previewCleanup(f.db, f.store.workspaceId, 90, now)), ["older"]);
  } finally { f.close(); }
});

test("changed previews, expiration, and active chats prevent execution", () => {
  const f = fixture();
  try {
    f.task("old"); const preview = f.store.previewCleanup(90);
    f.memory("new", "#task/old");
    assert.throws(() => f.store.executeCleanup(preview), /changed/);
    assert.throws(() => f.store.executeCleanup({ ...preview, asOf: f.old }), /expired/);
    assert.throws(() => f.store.previewCleanup(0), /Choose/);
    f.db.prepare("INSERT INTO chat_sessions(id,workspaceId,taskId,createdAt,updatedAt,lease) VALUES ('chat',?,'old',?,?,?)").run(f.store.workspaceId, f.old, f.old, "2999-01-01");
    const blocked = f.store.previewCleanup(90);
    assert.ok(blocked.blocked);
    assert.throws(() => f.store.executeCleanup(blocked), /Stop active/);
  } finally { f.close(); }
});

test("cleanup preserves usage totals and rolls back all deletions on failure", () => {
  const f = fixture();
  try {
    f.task("old"); f.artifact("document");
    f.db.prepare("INSERT INTO task_usage(id,workspaceId,taskId,agentName,model,kind,startedAt,outcome,credits) VALUES ('usage',?,'old','Agent','model','task',?,'Complete',12)").run(f.store.workspaceId, f.old);
    f.db.exec("CREATE TRIGGER fail_cleanup BEFORE DELETE ON artifacts BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    assert.throws(() => f.store.executeCleanup(f.store.previewCleanup(90)), /test failure/);
    assert.ok(f.db.prepare("SELECT id FROM tasks WHERE id = 'old'").get());
    assert.equal(f.db.prepare("SELECT taskId FROM task_usage").get()!.taskId, "old");
    f.db.exec("DROP TRIGGER fail_cleanup");
    f.store.executeCleanup(f.store.previewCleanup(90));
    const usage = f.db.prepare("SELECT taskId,runId,credits FROM task_usage").get()!;
    assert.equal(usage.credits, 12); assert.equal(usage.taskId, null); assert.equal(usage.runId, null);
  } finally { f.close(); }
});

test("date migration and triggers cover imports, repeated archives, and reactivation", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE artifacts(id TEXT, archived INTEGER); CREATE TABLE memory_entries(id TEXT, removed INTEGER); INSERT INTO artifacts VALUES ('old',1); INSERT INTO memory_entries VALUES ('old',1)");
    initializeCleanupSchema(db);
    const initial = db.prepare("SELECT archivedAt FROM artifacts WHERE id='old'").get()!.archivedAt;
    assert.ok(initial);
    db.exec("UPDATE artifacts SET archived=1; INSERT INTO memory_entries(id,removed) VALUES ('import',1)");
    assert.equal(db.prepare("SELECT archivedAt FROM artifacts").get()!.archivedAt, initial);
    assert.ok(db.prepare("SELECT retiredAt FROM memory_entries WHERE id='import'").get()!.retiredAt);
    db.exec("UPDATE memory_entries SET removed=0");
    assert.equal(db.prepare("SELECT retiredAt FROM memory_entries LIMIT 1").get()!.retiredAt, null);
  } finally { db.close(); }
});

test("queued runs block cleanup and retained run summaries protect referenced tasks", () => {
  const f = fixture();
  try {
    f.task("candidate"); f.task("active", "", false);
    f.db.prepare(`INSERT INTO runs(id,workspaceId,taskId,column,profile,status,createdAt,summary)
      VALUES ('run',?,'active','Done','{}','Queued',?,'[source](#task/candidate)')`).run(f.store.workspaceId, f.old);
    assert.ok(f.store.previewCleanup(90).blocked);
    f.db.exec("UPDATE runs SET status = 'Complete'");
    assert.equal(f.store.previewCleanup(90).blocked, null);
    assert.deepEqual(ids(f.store.previewCleanup(90)), []);
    f.db.exec("UPDATE tasks SET archivedAt = '2020-01-01' WHERE id = 'active'");
    const preview = f.store.previewCleanup(90);
    assert.deepEqual(ids(preview), ["active", "candidate"]);
    f.store.executeCleanup(preview);
    assert.equal(f.db.prepare("SELECT count(*) n FROM runs").get()!.n, 0);
  } finally { f.close(); }
});

test("retained memory replacements protect retired entries and versions", () => {
  const f = fixture();
  try {
    f.task("evidence"); f.memory("retired", "#task/evidence", true); f.memory("replacement", "");
    f.db.exec("UPDATE memory_entries SET supersedes = 'retired' WHERE id = 'replacement'");
    assert.deepEqual(ids(f.store.previewCleanup(90)), []);
  } finally { f.close(); }
});
