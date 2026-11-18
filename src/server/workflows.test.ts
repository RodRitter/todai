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
    assert.throws(() => f.store.save({ ...task, status: "In progress" }), /Stop.*before moving/);
    f.store.stopTask(task.id);
    f.store.save({ ...task, status: "In progress" });
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Stopped");
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

test("replacing board configuration requires stopping waiting workflow feedback first", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow); f.store.save(task); f.store.runTask(task.id);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Waiting", "Proceed?", "Yes");
    assert.throws(() => f.store.importConfiguration(f.store.exportConfiguration(), "replace"), /Stop active workflows/);
    f.store.stopTask(task.id);
    f.store.importConfiguration(f.store.exportConfiguration(), "replace");
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Stopped");
    f.store.runTask(task.id);
    assert.equal(f.store.workflowHistory(task.id).filter((execution) => ["Queued", "Running", "Waiting"].includes(execution.status)).length, 1);
  } finally { f.cleanup(); }
});

test("ordered steps advance exactly once with snapshotted agents and durable progress", () => {
  const f = fixture();
  try {
    const sequence = { id: "build", name: "Build and review", steps: [
      { id: "implement", agentId: "builder", instructions: "Implement" },
      { id: "review", agentId: "builder", instructions: "Review" },
    ] };
    f.store.saveWorkflow(sequence); f.store.save(task); f.store.runTask(task.id);
    f.store.saveAgent({ ...agent, model: "changed" });
    const first = f.store.claimRun()!;
    assert.equal(first.stepInstructions, "Implement");
    f.store.finishRun(first.id, "Complete", "Implemented");
    f.store.finishRun(first.id, "Complete", "Duplicate");
    const reopened = new TaskStore(f.path);
    try {
      const progress = reopened.workflowHistory(task.id)[0];
      assert.equal(progress.stepId, "review");
      assert.equal(progress.status, "Queued");
      assert.deepEqual(progress.steps?.map((step) => step.status), ["Complete", "Queued"]);
      const second = reopened.claimRun()!;
      assert.equal(second.stepInstructions, "Review");
      assert.equal(second.profile.model, "test");
      reopened.finishRun(second.id, "Complete", "Reviewed");
      assert.equal(reopened.claimRun(), undefined);
      assert.equal(reopened.workflowHistory(task.id)[0].status, "Complete");
      assert.equal(reopened.history(task.id).length, 2);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

for (const outcome of ["Failed", "Interrupted", "Stopped"] as const) {
  test(`explicit retry of a ${outcome} step preserves completion and the execution snapshot`, () => {
    const f = fixture();
    try {
      f.store.saveWorkflow({ id: "build", name: "Sequence", steps: [
        { id: "one", agentId: "builder", instructions: "First" },
        { id: "two", agentId: "builder", instructions: "Second" },
      ] });
      f.store.save(task); f.store.runTask(task.id);
      const first = f.store.claimRun()!;
      f.store.finishRun(first.id, "Complete", "First done");
      const second = f.store.claimRun()!;
      if (outcome === "Stopped") f.store.stopExecution(second.id);
      f.store.finishRun(second.id, outcome, "Work preserved");
      f.store.finishRun(second.id, "Complete", "Stale success");
      f.store.resumeExecution();
      assert.equal(f.store.claimRun(), undefined);
      f.store.saveWorkflow(workflow);
      f.store.saveAgent({ ...agent, model: "changed" });
      f.store.retryWorkflow(task.id, first.workflowExecutionId!);
      assert.throws(() => f.store.retryWorkflow(task.id, first.workflowExecutionId!), /retried|active/i);
      const retry = f.store.claimRun()!;
      assert.equal(retry.stepId, "two");
      assert.equal(retry.profile.model, "test");
      assert.equal(retry.stepInstructions, "Second");
      f.store.finishRun(retry.id, "Complete", "Second done");
      const history = f.store.workflowHistory(task.id);
      assert.equal(history.length, 1);
      assert.deepEqual(history[0].steps?.map((step) => step.status), ["Complete", "Complete"]);
      assert.equal(history[0].runs.length, 3);
    } finally { f.cleanup(); }
  });
}

test("restart interrupts an abandoned step and explicit recovery never replays completed steps", async () => {
  const { spawnSync } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const { ExecutionService } = await import("./execution-service.ts");
  const f = fixture();
  try {
    f.store.saveWorkflow({ id: "build", name: "Sequence", steps: [
      { id: "one", agentId: "builder", instructions: "First" },
      { id: "two", agentId: "builder", instructions: "Second" },
    ] });
    f.store.save(task); f.store.runTask(task.id);
    const first = f.store.claimRun()!;
    f.store.finishRun(first.id, "Complete", "First done");
    const child = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import { TaskStore } from ${JSON.stringify(pathToFileURL(join(process.cwd(), "src/server/task-store.ts")).href)};
      const store = new TaskStore(${JSON.stringify(f.path)});
      store.claimRun(); store.close();
    `]);
    assert.equal(child.status, 0, child.stderr.toString());
    const reopened = new TaskStore(f.path);
    try {
      const executed: string[] = [];
      const service = new ExecutionService(reopened, async ({ run }) => { executed.push(run.stepId!); return "Recovered"; });
      await service.drain();
      const progress = reopened.workflowHistory(task.id)[0];
      assert.deepEqual(progress.steps?.map((step) => step.status), ["Complete", "Interrupted"]);
      assert.deepEqual(executed, []);
      reopened.retryWorkflow(task.id, progress.id);
      await service.drain();
      assert.deepEqual(executed, ["two"]);
      assert.equal(reopened.workflowHistory(task.id)[0].status, "Complete");
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("feedback and queued cancellation keep the active step and respect queue pause", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow({ id: "build", name: "Sequence", steps: [
      { id: "one", agentId: "builder", instructions: "First" },
      { id: "two", agentId: "builder", instructions: "Second" },
    ] });
    f.store.save(task); f.store.runTask(task.id);
    const first = f.store.claimRun()!;
    f.store.finishRun(first.id, "Waiting", "Proceed?", "Yes");
    const question = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    f.store.answerFeedback(task.id, question.id, "Yes");
    const resumed = f.store.claimRun()!;
    assert.equal(resumed.stepId, "one");
    f.store.finishRun(resumed.id, "Complete", "First done");
    f.store.stopTask(task.id);
    f.store.pauseExecution();
    f.store.retryWorkflow(task.id, first.workflowExecutionId!);
    assert.equal(f.store.claimRun(), undefined);
    f.store.resumeExecution();
    const second = f.store.claimRun()!;
    assert.equal(second.stepId, "two");
    f.store.stopTask(task.id);
    f.store.finishRun(second.id, "Complete", "Success raced with stop");
    f.store.resumeExecution();
    assert.equal(f.store.claimRun(), undefined);
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Stopped");
  } finally { f.cleanup(); }
});

test("a checkpoint waits durably without an agent and approval advances exactly once", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow({ id: "build", name: "Approve then build", steps: [
      { id: "approval", kind: "checkpoint", instructions: "Review the plan before implementation." },
      { id: "implement", agentId: "builder", instructions: "Implement the approved plan" },
    ] });
    f.store.save(task); f.store.runTask(task.id);
    assert.equal(f.store.claimRun(), undefined);
    assert.equal(f.store.history(task.id).length, 0);
    const pending = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    assert.equal(pending.feedbackKind, "checkpoint");
    assert.equal(pending.body, "Review the plan before implementation.");
    const reopened = new TaskStore(f.path);
    try {
      assert.equal(reopened.workflowHistory(task.id)[0].status, "Waiting");
      assert.equal(reopened.list()[0].agentStatus, "Waiting");
      reopened.answerFeedback(task.id, pending.id, "Plan looks good", "approve");
      assert.throws(() => reopened.answerFeedback(task.id, pending.id, "Duplicate", "approve"), /no longer pending/);
      const run = reopened.claimRun()!;
      assert.equal(run.stepId, "implement");
      reopened.finishRun(run.id, "Complete", "Built");
      assert.deepEqual(reopened.workflowHistory(task.id)[0].steps?.map((step) => step.status), ["Complete", "Complete"]);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("changes requested preserve evidence and wait for a fresh explicit decision across restart", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow({ id: "build", name: "Build then approve", steps: [
      { id: "implement", agentId: "builder", instructions: "Build" },
      { id: "approval", kind: "checkpoint", instructions: "Review the implementation and evidence." },
    ] });
    f.store.save(task); f.store.runTask(task.id);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Complete", "Implemented with verified results.");
    const comments = f.store.list()[0].comments!;
    const pending = comments.find((comment) => comment.feedbackStatus === "pending")!;
    const result = comments.find((comment) => comment.runId === run.id)!;
    assert.equal(pending.evidenceCommentId, result.id);
    assert.equal(pending.workflowExecutionId, run.workflowExecutionId);
    assert.throws(() => f.store.answerFeedback(task.id, pending.id, "Looks fine"), /Choose Approve/);
    f.store.answerFeedback(task.id, pending.id, "Fix the keyboard focus", "changes-requested");
    assert.throws(() => f.store.answerFeedback(task.id, pending.id, "Duplicate", "changes-requested"), /no longer pending/);
    const reopened = new TaskStore(f.path);
    try {
      assert.equal(reopened.claimRun(), undefined);
      assert.equal(reopened.workflowHistory(task.id)[0].status, "Waiting");
      const records = reopened.list()[0].comments!;
      const response = records.find((comment) => comment.responseTo === pending.id)!;
      assert.equal(response.authorName, "Human");
      assert.equal(response.decision, "changes-requested");
      assert.equal(response.body, "Fix the keyboard focus");
      const current = records.find((comment) => comment.feedbackStatus === "pending")!;
      assert.notEqual(current.id, pending.id);
      assert.equal(current.evidenceCommentId, result.id);
      reopened.answerFeedback(task.id, current.id, "Verified the correction", "approve");
      assert.equal(reopened.workflowHistory(task.id)[0].status, "Complete");
      assert.equal(reopened.list()[0].agentStatus, "Complete");
      assert.equal(reopened.history(task.id).length, 1);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("stopped checkpoints recover explicitly and old answers cannot advance a new execution", () => {
  const f = fixture();
  try {
    f.store.saveWorkflow({ id: "build", name: "Approvals", steps: [
      { id: "first", kind: "checkpoint", instructions: "Review plan" },
      { id: "second", kind: "checkpoint", instructions: "Review release" },
    ] });
    f.store.save(task); f.store.runTask(task.id);
    const request = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    assert.throws(() => f.store.save({ ...task, workflowId: null }), /Finish or stop/);
    f.store.stopTask(task.id);
    const execution = f.store.workflowHistory(task.id)[0];
    assert.equal(execution.status, "Stopped");
    f.store.pauseExecution();
    f.store.retryWorkflow(task.id, execution.id);
    assert.equal(f.store.list()[0].agentStatus, "Waiting");
    assert.equal(f.store.executionState().paused, true);
    assert.throws(() => f.store.answerFeedback(task.id, request.id, "Old", "approve"), /no longer pending/);
    const retry = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    f.store.answerFeedback(task.id, retry.id, "Approved", "approve");
    assert.equal(f.store.workflowHistory(task.id)[0].stepId, "second");
    assert.equal(f.store.workflowHistory(task.id)[0].status, "Waiting");
    f.store.stopTask(task.id); f.store.runTask(task.id);
    assert.throws(() => f.store.answerFeedback(task.id, retry.id, "Old", "approve"), /no longer pending/);
    assert.equal(f.store.workflowHistory(task.id)[0].stepId, "first");
    assert.equal(f.store.claimRun(), undefined);
    assert.throws(() => f.store.deleteComment(task.id, retry.id), /workflow history/i);
  } finally { f.cleanup(); }
});

test("agent questions resume their step and checkpoint evidence keeps exact artifact revisions", async () => {
  const { ArtifactStore } = await import("./artifact-store.ts");
  const f = fixture();
  const library = new ArtifactStore(f.path, f.store.workspaceId);
  try {
    f.store.saveWorkflow({ id: "build", name: "Build then approve", steps: [
      { id: "implement", agentId: "builder", instructions: "Build" },
      { id: "approval", kind: "checkpoint", instructions: "Review results" },
    ] });
    const artifact = library.create({ title: "Verification", type: "text", content: "Verified revision", creator: "Builder" });
    const pinned = { artifactId: artifact.id, revisionId: artifact.revisionId };
    f.store.save(task); f.store.runTask(task.id);
    const first = f.store.claimRun()!;
    f.store.finishRun(first.id, "Waiting", "Which option?", "Use option A", undefined, [pinned]);
    const question = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    assert.throws(() => f.store.answerFeedback(task.id, question.id, "Approved", "approve"), /freeform reply/);
    f.store.answerFeedback(task.id, question.id, "Use option B");
    const resumed = f.store.claimRun()!;
    assert.equal(resumed.stepId, "implement");
    f.store.finishRun(resumed.id, "Complete", "Built option B", undefined, undefined, [pinned]);
    f.store.finishRun(resumed.id, "Complete", "Duplicate");
    library.revise(artifact.id, { title: "Verification", type: "text", content: "Later revision", creator: "Human" });
    const comments = f.store.list()[0].comments!;
    const checkpoint = comments.find((comment) => comment.feedbackStatus === "pending")!;
    assert.equal(checkpoint.feedbackKind, "checkpoint");
    assert.deepEqual(comments.find((comment) => comment.id === checkpoint.evidenceCommentId)!.artifacts, [pinned]);
    assert.equal(comments.filter((comment) => comment.feedbackKind === "checkpoint").length, 1);
    assert.throws(() => f.store.deleteComment(task.id, checkpoint.evidenceCommentId!), /workflow history/);
    assert.equal(f.store.claimRun(), undefined);
  } finally { library.close(); f.cleanup(); }
});

test("existing workflow questions gain originating execution context when the database is upgraded", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const f = fixture();
  try {
    f.store.saveWorkflow(workflow); f.store.save(task); f.store.runTask(task.id);
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Waiting", "Proceed?", "Use option A");
    // Recreate the pre-checkpoint comment schema as the migration fixture.
    const legacy = new DatabaseSync(f.path);
    try {
      for (const column of ["workflowExecutionId", "stepId", "responseTo", "decision", "feedbackKind", "evidenceCommentId"])
        legacy.exec(`ALTER TABLE comments DROP COLUMN ${column}`);
    } finally { legacy.close(); }
    const reopened = new TaskStore(f.path);
    try {
      const question = reopened.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
      assert.equal(question.workflowExecutionId, run.workflowExecutionId);
      assert.equal(question.stepId, run.stepId);
      reopened.answerFeedback(task.id, question.id, "Proceed with A");
      const reply = reopened.list()[0].comments!.find((comment) => comment.responseTo === question.id)!;
      assert.equal(reply.workflowExecutionId, question.workflowExecutionId);
      assert.equal(reopened.claimRun()!.stepId, run.stepId);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});
