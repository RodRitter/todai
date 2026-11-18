import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";

const agent = { id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build carefully", permissions: "workspace-write" };
const workflow = { id: "build", name: "Build feature", agentId: "builder", instructions: "Implement and verify the task." };
const task = { id: "task", title: "Build", description: "Details", status: "To do", workflowId: "build", autoRun: true, autoWorkflow: true };
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-workflows-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  store.saveAgent(agent);
  return { store, path, cleanup() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("a saved reusable workflow runs without a column agent and records its execution", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow);
    assert.deepEqual(f.store.listWorkflows(), [workflow]);
    assert.equal(f.store.save(task).agentStatus, "Not started");
    f.store.runTask(task.id);
    assert.throws(() => f.store.runTask(task.id), /already has/);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Complete", "Built and verified.");
    f.store.finishRun(run.id, "Complete", "Duplicate");
    const [execution] = f.store.workflowHistory(task.id);
    assert.equal(execution.workflow.name, "Build feature");
    assert.equal(execution.status, "Complete");
    assert.equal(execution.runs.length, 1);
    assert.equal(execution.runs[0].summary, "Built and verified.");
    assert.equal(f.store.list()[0].status, "To do");
    const reopened = new TaskStore(f.path);
    try { assert.deepEqual(reopened.workflowHistory(task.id), [execution]); } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("feedback resumes the same snapshotted step after workflow and agent edits", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow);
    f.store.save(task);
    f.store.runTask(task.id);
    f.store.saveWorkflow({ ...workflow, instructions: "New step", name: "Changed" });
    f.store.saveAgent({ ...agent, instructions: "New agent", model: "new-model" });
    const run = f.store.claimRun()!;
    assert.equal(run.profile.instructions, "Build carefully");
    assert.equal(run.stepInstructions, "Implement and verify the task.");
    f.store.finishRun(run.id, "Waiting", "Which approach?", "Use the simple one.");
    assert.throws(() => f.store.runTask(task.id), /pending feedback/);
    const comment = f.store.list()[0].comments!.find((item) => item.feedbackStatus === "pending")!;
    f.store.answerFeedback(task.id, comment.id, "Yes");
    assert.throws(() => f.store.answerFeedback(task.id, comment.id, "Duplicate"), /no longer pending/);
    const resumed = f.store.claimRun()!;
    assert.equal(resumed.workflowExecutionId, run.workflowExecutionId);
    assert.equal(resumed.stepInstructions, "Implement and verify the task.");
    f.store.finishRun(resumed.id, "Complete", "Done");
    assert.equal(f.store.workflowHistory(task.id).length, 1);
    assert.equal(f.store.workflowHistory(task.id)[0].runs.length, 2);
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Complete");
    f.store.runTask(task.id);
    const next = f.store.claimRun()!;
    assert.equal(next.profile.model, "new-model");
    assert.equal(next.stepInstructions, "New step");
  } finally { f.cleanup(); }
});

test("execution history preserves the exact supplied prompt, step, outcome and result", async () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow);
    f.store.save(task);
    f.store.runTask(task.id);
    const { ExecutionService } = await import("./execution-service.ts");
    const { agentPrompt } = await import("./agent-prompt.ts");
    let supplied = "";
    await new ExecutionService(f.store, async (request) => {
      supplied = agentPrompt(request);
      assert.match(supplied, /Implement and verify the task\./);
      assert.match(supplied, /Build carefully/);
      assert.match(supplied, /Task: Build/);
      return "Verified the implementation.";
    }).drain();
    const [execution] = f.store.workflowHistory(task.id);
    assert.equal(execution.status, "Complete");
    assert.equal(execution.runs[0].prompt, supplied);
    assert.equal(execution.runs[0].summary, "Verified the implementation.");
    f.store.save({ ...task, description: "Later edit" });
    assert.equal(f.store.workflowHistory(task.id)[0].runs[0].prompt, supplied);
  } finally { f.cleanup(); }
});

test("stopping waiting workflow work preserves history and permits an explicit new execution", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow);
    f.store.save(task);
    f.store.runTask(task.id);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Waiting", "Proceed?", "Yes");
    f.store.stopTask(task.id);
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Stopped");
    assert.equal(f.store.list()[0].comments!.find((comment) => comment.runId === run.id)!.feedbackStatus, "cancelled");
    f.store.runTask(task.id);
    assert.equal(f.store.workflowHistory(task.id).length, 2);
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Queued");
  } finally { f.cleanup(); }
});

for (const outcome of ["Failed", "Interrupted", "Stopped"] as const) {
  test(`${outcome} workflow attempts preserve history and do not advance or restart`, () => {
    const f = fixture();
    try {
      f.store.saveWorkflow(workflow); f.store.save(task); f.store.runTask(task.id);
      const run = f.store.claimRun()!;
      if (outcome === "Stopped") f.store.stopExecution(run.id);
      f.store.finishRun(run.id, outcome, "Work preserved.");
      f.store.finishRun(run.id, "Complete", "Stale success");
      assert.equal(f.store.workflowHistory(task.id)[0].status, outcome);
      assert.equal(f.store.list()[0].status, "To do");
      f.store.resumeExecution();
      assert.equal(f.store.claimRun(), undefined);
      f.store.runTask(task.id);
      assert.equal(f.store.workflowHistory(task.id).length, 2);
    } finally { f.cleanup(); }
  });
}

test("queued cancellation, column movement and comment replies cannot progress a workflow", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow); f.store.save(task); f.store.runTask(task.id);
    assert.throws(() => f.store.save({ ...task, workflowId: null }), /Finish or stop/);
    f.store.stopTask(task.id);
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Stopped");
    f.store.runTask(task.id);
    f.store.save({ ...task, status: "In progress" });
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Interrupted");
    assert.equal(f.store.claimRun(), undefined);
    f.store.runTask(task.id);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Complete", "Done");
    const before = f.store.workflowHistory(task.id);
    f.store.postComment(task.id, "@Builder explain the result");
    const intent = f.store.claimRun()!;
    assert.equal(intent.kind, "intent");
    f.store.finishRun(intent.id, "Complete", "Builder", undefined, [run.profile]);
    const reply = f.store.claimRun()!;
    f.store.finishRun(reply.id, "Complete", "Explanation");
    assert.deepEqual(f.store.workflowHistory(task.id), before);
    assert.equal(f.store.list()[0].status, "In progress");
  } finally { f.cleanup(); }
});

test("replacing board configuration terminates cancelled workflow feedback", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow); f.store.save(task); f.store.runTask(task.id);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Waiting", "Proceed?", "Yes");
    f.store.importConfiguration(f.store.exportConfiguration(), "replace");
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Interrupted");
    f.store.runTask(task.id);
    assert.equal(f.store.workflowHistory(task.id).filter((execution) => ["Queued", "Running", "Waiting"].includes(execution.status)).length, 1);
  } finally { f.cleanup(); }
});
