import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";
import { ExecutionService } from "./execution-service.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-manual-run-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  store.saveAgent({ id: "builder", name: "Builder", tool: "codex", model: "test-model", effort: "high", instructions: "Build carefully", permissions: "workspace-write" });
  for (const column of ["In progress", "In review"])
    store.assignColumnAgent({ column, agentId: "builder" });
  return { store, path, cleanup() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}

const draft = { id: "task", title: "Build", description: "Details", status: "In progress" };

test("manual mode persists and prevents runs on creation and column entry", () => {
  const f = fixture();
  try {
    const task = f.store.save(draft);
    assert.equal(task.agentStatus, "Not started");
    f.store.save({ ...task, status: "In review" });
    assert.deepEqual(f.store.history(task.id), []);
    const reopened = new TaskStore(f.path);
    try { assert.equal(reopened.list()[0].autoRun, false); } finally { reopened.close(); }
    assert.throws(() => f.store.save({ ...draft, autoRun: "true" }), /valid task properties/);
    f.store.save({ ...draft, autoRun: true });
    assert.equal(f.store.save(draft).autoRun, true);

  } finally { f.cleanup(); }
});

test("Run executes the assigned agent once and rejects duplicate or invalid requests", async () => {
  const f = fixture();
  let calls = 0;
  const service = new ExecutionService(f.store, async () => { calls++; return "Finished"; });
  try {
    f.store.save(draft);
    assert.equal(f.store.runTask(draft.id).agentStatus, "Queued");
    assert.throws(() => f.store.runTask(draft.id), /already has/);
    await service.drain();
    assert.equal(calls, 1);
    assert.equal(f.store.list()[0].agentStatus, "Complete");
    assert.throws(() => f.store.runTask("missing"), /no longer exists/);
    f.store.save({ ...draft, status: "To do" });
    assert.throws(() => f.store.runTask(draft.id), /Assign an agent/);
    assert.equal(f.store.history(draft.id).length, 1);
  } finally { f.cleanup(); }
});

test("auto-workflow moves manual tasks without starting the next agent", async () => {
  const f = fixture();
  const service = new ExecutionService(f.store, async () => "Finished");
  try {
    f.store.save({ ...draft, autoWorkflow: true });
    f.store.runTask(draft.id);
    await service.drain();
    assert.equal(f.store.list()[0].status, "In review");
    assert.equal(f.store.history(draft.id).length, 1);
    f.store.runTask(draft.id);
    assert.equal(f.store.history(draft.id)[1].column, "In review");
  } finally { f.cleanup(); }
});

test("manual Run cannot bypass running agents or pending feedback", () => {
  const f = fixture();
  try {
    f.store.save(draft);
    f.store.runTask(draft.id);
    const run = f.store.claimRun()!;
    assert.throws(() => f.store.runTask(draft.id), /already has/);
    f.store.finishRun(run.id, "Waiting", "Which approach?", "Use the simpler approach.");
    assert.throws(() => f.store.runTask(draft.id), /pending feedback/);
  } finally { f.cleanup(); }
});

test("automatic execution requires an explicit opt-in", () => {
  const f = fixture();
  try {
    const task = f.store.save({ id: "auto", title: "Build", description: "", status: "In progress", autoRun: true });
    assert.equal(task.autoRun, true);
    assert.equal(task.agentStatus, "Queued");
  } finally { f.cleanup(); }
});
