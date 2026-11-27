import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaskStore } from "./task-store.ts";
import { ExecutionService } from "./execution-service.ts";
import { agentPrompt } from "./agent-prompt.ts";

const change = { operation: "add", title: "Release", category: "Terms", statement: "A release is a published version.", scope: "Workspace", source: "[Task one](#task/one)", reason: "The task defines this term." };
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "todai-memory-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  store.setWorkspacePath(directory);
  store.renameColumn("Done", "Done", undefined, true);
  return { store, path, directory, close: () => { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}
function complete(store: TaskStore, id = "one") { return store.save({ id, title: "Document a release", description: "", status: "Done" }); }
function review(store: TaskStore, changes: unknown[] = [change]) {
  const run = store.claimRun()!;
  assert.equal(run.kind, "memory");
  store.finishRun(run.id, "Complete", JSON.stringify({ changes }));
  return store.list().find((task) => task.id === run.taskId)!;
}

test("completion queues one review and records memory automatically without moving the task", () => {
  const f = setup();
  try {
    const task = complete(f.store); f.store.save(task);
    assert.equal(f.store.history().length, 1);
    const reviewed = review(f.store);
    assert.equal(reviewed.status, "Done");
    assert.equal(reviewed.agentStatus, "Complete");
    assert.equal(reviewed.comments!.at(-1)!.feedbackStatus, null);
    assert.match(reviewed.comments!.at(-1)!.body, /1 added/);
    assert.equal(f.store.searchMemory().total, 1);
    assert.equal(f.store.workspaceMemory().revision, 1);
    const reopened = new TaskStore(f.path);
    try { assert.equal(reopened.searchMemory().entries[0].statement, change.statement); }
    finally { reopened.close(); }
    f.store.delete("one");
    assert.equal(f.store.memorySnapshot().current!.source!.taskId, "one");
  } finally { f.close(); }
});

test("automatic memory is shared across boards and isolated across workspaces", () => {
  const f = setup();
  try {
    complete(f.store); review(f.store);
    const board = f.store.saveBoard("Second");
    const second = new TaskStore(f.path, f.store.workspaceId, { boardId: board.id });
    try { assert.equal(second.searchMemory().total, 1); assert.equal(second.completionColumn(), null); }
    finally { second.close(); }
    const workspace = f.store.createWorkspace("Other", f.directory);
    const other = new TaskStore(f.path, workspace.id);
    try { assert.equal(other.searchMemory().total, 0); } finally { other.close(); }
  } finally { f.close(); }
});

test("completion selection is exclusive and survives rename and reorder", () => {
  const f = setup();
  try {
    f.store.renameColumn("In review", "Accepted", "", true);
    f.store.renameColumn("Accepted", "Released");
    f.store.reorderColumns(["Released", "To do", "In progress", "Done"]);
    assert.equal(f.store.completionColumn(), "Released");
    f.store.renameColumn("Released", "Released", "", false);
    assert.equal(f.store.completionColumn(), null);
    const config = f.store.exportConfiguration();
    assert.throws(() => f.store.importConfiguration({ ...config, columns: config.columns.map((column) => ({ ...column, completion: true })) }), /at most one/);
  } finally { f.close(); }
});

test("no-op reviews and rejected document output do not change recorded memory", async () => {
  const f = setup();
  try {
    complete(f.store); review(f.store, []);
    assert.equal(f.store.workspaceMemory().revision, 0);
    assert.equal(f.store.list()[0].comments!.at(-1)!.body, "No memory changes recorded.");
    complete(f.store, "two");
    await new ExecutionService(f.store, async (request) => {
      assert.ok(request.artifacts);
      assert.ok(JSON.stringify(request.workspaceMemory).length <= 4000);
      assert.match(agentPrompt(request), /automatically/);
      assert.match(agentPrompt(request), /#task\/two/);
      return JSON.stringify({ document: "Old document format" });
    }).drain();
    assert.equal(f.store.list().find((task) => task.id === "two")!.agentStatus, "Failed");
    assert.equal(f.store.workspaceMemory().revision, 0);
  } finally { f.close(); }
});

test("old pending approvals are replaced with one fresh automatic run", () => {
  const f = setup();
  try {
    complete(f.store);
    const run = f.store.claimRun()!;
    const db = new DatabaseSync(f.path);
    db.prepare("UPDATE runs SET status = 'Waiting' WHERE id = ?").run(run.id);
    db.close();
    f.store.addComment({ id: "old", taskId: "one", runId: run.id, body: "Old proposal", recommendation: "Review", feedbackStatus: "pending", responseType: "memory", createdAt: new Date().toISOString() });
    const reopened = new TaskStore(f.path);
    try {
      assert.equal(reopened.list()[0].comments![0].feedbackStatus, "cancelled");
      assert.equal(reopened.history().filter((item) => item.status === "Queued").length, 1);
      assert.equal(reopened.history().find((item) => item.id === run.id)!.status, "Stopped");
      review(reopened);
      assert.equal(reopened.searchMemory().total, 1);
    } finally { reopened.close(); }
  } finally { f.close(); }
});

test("clear memory cancels queued and running reviews and prevents late output from restoring memory", () => {
  const f = setup();
  try {
    complete(f.store); review(f.store);
    complete(f.store, "running"); const running = f.store.claimRun()!;
    complete(f.store, "queued");
    assert.deepEqual(f.store.clearMemory(), { cleared: 1 });
    assert.ok(f.store.interruptionRequested(running.id));
    f.store.finishRun(running.id, "Complete", JSON.stringify({ changes: [change] }));
    assert.equal(f.store.history("running")[0].status, "Stopped");
    assert.equal(f.store.history("queued")[0].status, "Stopped");
    assert.equal(f.store.searchMemory().total, 0);
    assert.deepEqual(f.store.memorySnapshot(), { current: null });
    const reopened = new TaskStore(f.path);
    try { assert.equal(reopened.searchMemory().total, 0); } finally { reopened.close(); }
  } finally { f.close(); }
});

test("memory endpoints require workspace scope and explicit clear confirmation", async () => {
  const { GET, DELETE } = await import("../app/api/memory/route.ts");
  const f = setup(); const previous = process.env.TODAI_DB_PATH; process.env.TODAI_DB_PATH = f.path;
  try {
    complete(f.store); review(f.store);
    assert.equal(GET(new Request("http://localhost/api/memory")).status, 400);
    const request = (confirmation?: string, workspace = f.store.workspaceId) => new Request("http://localhost/api/memory", { method: "DELETE", headers: { "X-Todai-Workspace": workspace }, body: JSON.stringify({ confirmation }) });
    assert.equal((await DELETE(request())).status, 400);
    assert.equal((await DELETE(request("clear-memory", "missing"))).status, 400);
    assert.equal(f.store.searchMemory().total, 1);
    assert.deepEqual(await (await DELETE(request("clear-memory"))).json(), { cleared: 1 });
  } finally {
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    f.close();
  }
});

test("memory corrections require workspace ownership and current revisions", async () => {
  const { GET, PATCH } = await import("../app/api/memory/route.ts");
  const f = setup(); const previous = process.env.TODAI_DB_PATH; process.env.TODAI_DB_PATH = f.path;
  try {
    complete(f.store); review(f.store);
    const entry = f.store.searchMemory().entries[0];
    const request = (body: unknown, workspace = f.store.workspaceId) => new Request("http://localhost/api/memory", { method: "PATCH", headers: { "X-Todai-Workspace": workspace }, body: JSON.stringify(body) });
    const correction = { ...entry, operation: "update", statement: "Corrected summary.", details: "Supporting evidence.", reason: "Checked the original task." };
    assert.equal((await PATCH(request(correction, "missing"))).status, 400);
    assert.equal((await PATCH(request(correction))).status, 200);
    assert.equal((await PATCH(request(correction))).status, 400);
    const response = GET(new Request(`http://localhost/api/memory?view=history&id=${entry.id}`, { headers: { "X-Todai-Workspace": f.store.workspaceId } }));
    const versions = await response.json();
    assert.equal(versions.length, 2);
    assert.equal(versions[0].entry.details, "Supporting evidence.");
    assert.match(f.store.memorySnapshot().current!.document, /Corrected summary/);
  } finally {
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    f.close();
  }
});
