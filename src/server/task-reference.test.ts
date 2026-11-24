import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore } from "./task-store.ts";
import { resolveTaskReference } from "./database.ts";
import { normalizeTaskReferences, parseTaskReference, taskReference } from "../domain/task-reference.ts";

test("task references use IDs and support previous local links", () => {
  assert.equal(taskReference("task one"), "[Task task one](#task/task%20one)");
  assert.equal(parseTaskReference("#task/task%20one"), "task one");
  assert.equal(parseTaskReference("#task/%zz"), null);
  assert.equal(parseTaskReference("/?workspace=one&board=two&task=three"), "three");
  assert.equal(parseTaskReference("https://other.example/?task=three"), null);
  assert.equal(normalizeTaskReferences("Source: [Task](/?workspace=w&task=t)"), "Source: [Task t](#task/t)");
});

test("archived task references retain comments, identity, and ownership after reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-reference-"));
  const path = join(directory, "tasks.sqlite");
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = path;
  const store = new TaskStore(path);
  try {
    const task = store.save({ id: "source", title: "Source task", description: "Evidence", status: "Done" });
    store.addComment({ id: "comment", taskId: task.id, body: "Verified result", createdAt: new Date().toISOString() });
    store.delete(task.id);
    assert.equal(store.boardSnapshot().tasks.length, 0);
    assert.ok(store.readTask(task.id)!.archivedAt);
    assert.throws(() => store.save(task), /Archived/);
    assert.throws(() => store.runTask(task.id));
    const reference = resolveTaskReference(task.id)!;
    assert.equal(reference.task.id, task.id);
    assert.equal(reference.task.comments![0].body, "Verified result");
    assert.equal(reference.workspace.id, store.workspaceId);
    const otherWorkspace = store.createWorkspace("Other", directory);
    const other = new TaskStore(path, otherWorkspace.id);
    try { assert.throws(() => other.readTask(task.id), /workspace/); }
    finally { other.close(); }
    assert.equal(resolveTaskReference("missing"), null);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
