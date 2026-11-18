import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { ExecutionService } from "./execution-service.ts";

const agent = { id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build carefully", permissions: "workspace-write" };
const section = { id: "review", kind: "review", agentId: "builder", instructions: "Review correctness", revisionAgentId: "builder", revisionInstructions: "Fix findings", maxRounds: 3 };
function fixture(maxRounds = 3) {
  const directory = mkdtempSync(join(tmpdir(), "todai-review-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  store.saveAgent(agent);
  store.saveWorkflow({ id: "loop", name: "Review loop", steps: [{ ...section, maxRounds }, { id: "publish", agentId: "builder", instructions: "Publish approved work" }] });
  store.save({ id: "task", title: "Build", description: "Details", status: "To do", workflowId: "loop" });
  store.runTask("task");
  return { store, path, cleanup() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}
const approved = JSON.stringify({ outcome: "approved", findings: "All checks passed." });
const changes = JSON.stringify({ outcome: "changes-requested", findings: "Fix keyboard focus." });

test("explicit reviewer approval exits the section once and preserves the decision", async () => {
  const f = fixture();
  try {
    const run = f.store.claimRun()!;
    assert.match(run.stepInstructions!, /approved/);
    f.store.finishRun(run.id, "Complete", approved);
    f.store.finishRun(run.id, "Complete", changes);
    const execution = f.store.workflowHistory("task")[0];
    assert.equal(execution.stepId, "publish");
    assert.equal(execution.steps?.[0].status, "Complete");
    assert.equal(execution.steps?.[0].review?.round, 1);
    assert.equal(execution.steps?.[0].review?.attempts[0].outcome, "approved");
    assert.equal(f.store.claimRun()!.stepId, "publish");
  } finally { f.cleanup(); }
});

test("changes requested run revisions with findings and repeat review until explicit approval", async () => {
  const f = fixture();
  try {
    const instructions: string[] = [];
    let reviews = 0;
    await new ExecutionService(f.store, async ({ run }) => {
      instructions.push(run.stepInstructions!);
      if (run.stepId === "publish") return "Published";
      if (run.stepInstructions!.startsWith("Fix")) {
        assert.match(run.stepInstructions!, /Fix keyboard focus/);
        return "Fixed keyboard focus";
      }
      return ++reviews === 3 ? approved : changes;
    }).drain();
    const execution = f.store.workflowHistory("task")[0];
    assert.equal(execution.status, "Complete");
    assert.equal(instructions.length, 6);
    assert.deepEqual(execution.steps![0].review!.attempts.map((item) => [item.role, item.round]), [
      ["review", 1], ["revise", 1], ["review", 2], ["revise", 2], ["review", 3],
    ]);
    assert.equal(execution.steps![0].review!.attempts[2].reviewedRunId, execution.runs[1].id);
  } finally { f.cleanup(); }
});

test("round exhaustion waits durably before revision and allows exactly one additional round or stop", () => {
  const f = fixture(1);
  try {
    const review = f.store.claimRun()!;
    f.store.finishRun(review.id, "Complete", changes);
    assert.equal(f.store.claimRun(), undefined);
    const reopened = new TaskStore(f.path);
    try {
      assert.equal(reopened.workflowHistory("task")[0].status, "Waiting");
      const request = reopened.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
      assert.equal(request.feedbackKind, "review-limit");
      assert.throws(() => reopened.answerFeedback("task", request.id, "Yes", "approve"), /additional round/i);
      reopened.pauseExecution();
      reopened.answerFeedback("task", request.id, "Try once more", "additional-round");
      assert.throws(() => reopened.answerFeedback("task", request.id, "Again", "additional-round"), /no longer pending/);
      assert.equal(reopened.claimRun(), undefined);
      reopened.resumeExecution();
      const revision = reopened.claimRun()!;
      assert.match(revision.stepInstructions!, /Fix keyboard focus/);
      reopened.finishRun(revision.id, "Complete", "Fixed");
      const second = reopened.claimRun()!;
      reopened.finishRun(second.id, "Complete", changes);
      const state = reopened.workflowHistory("task")[0].steps![0].review!;
      assert.equal(state.round, 2);
      assert.equal(state.limit, 2);
      const pending = reopened.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
      reopened.answerFeedback("task", pending.id, "Stop here", "stop");
      assert.equal(reopened.workflowHistory("task")[0].status, "Stopped");
      assert.equal(reopened.claimRun(), undefined);
      reopened.retryWorkflow("task", review.workflowExecutionId!);
      assert.equal(reopened.workflowHistory("task")[0].status, "Waiting");
      assert.equal(reopened.claimRun(), undefined);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("reviewer feedback resumes the snapshotted reviewer and counts every attempt", () => {
  const f = fixture();
  try {
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Waiting", "Which standard?", "Use accessibility guidelines");
    f.store.saveAgent({ ...agent, model: "changed" });
    const question = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    f.store.answerFeedback("task", question.id, "Use WCAG");
    const resumed = f.store.claimRun()!;
    assert.equal(resumed.profile.model, "test");
    f.store.finishRun(resumed.id, "Complete", approved);
    const execution = f.store.workflowHistory("task")[0];
    assert.equal(execution.steps![0].review!.round, 2);
    assert.equal(execution.steps![0].review!.attempts[1].outcome, "approved");
    assert.equal(execution.stepId, "publish");
  } finally { f.cleanup(); }
});

for (const output of ["Looks good", '{"outcome":"approved"}', '{"outcome":"maybe","findings":"Uncertain"}', '{"outcome":"approved","findings":"  "}']) {
  test(`malformed reviewer output pauses instead of approving: ${output}`, async () => {
    const f = fixture();
    try {
      await new ExecutionService(f.store, async () => output).drain();
      const execution = f.store.workflowHistory("task")[0];
      assert.equal(execution.status, "Failed");
      assert.equal(execution.stepId, "review");
      assert.equal(execution.runs.length, 1);
      assert.equal(execution.steps![0].review!.attempts[0].outcome, "invalid");
      f.store.retryWorkflow("task", execution.id);
      const retry = f.store.claimRun()!;
      f.store.finishRun(retry.id, "Complete", approved);
      assert.equal(f.store.workflowHistory("task")[0].stepId, "publish");
    } finally { f.cleanup(); }
  });
}

for (const role of ["review", "revise"]) {
  for (const outcome of ["Failed", "Interrupted", "Stopped"] as const) {
    test(`${outcome} ${role} attempt preserves position and ignores late completion`, () => {
      const f = fixture();
      try {
        if (role === "revise") {
          const review = f.store.claimRun()!;
          f.store.finishRun(review.id, "Complete", changes);
        }
        const run = f.store.claimRun()!;
        if (outcome === "Stopped") f.store.stopTask("task");
        f.store.finishRun(run.id, outcome, "Work preserved");
        f.store.finishRun(run.id, "Complete", approved);
        const before = f.store.workflowHistory("task")[0];
        assert.equal(before.status, outcome);
        assert.equal(before.steps![0].review!.phase, role);
        assert.equal(f.store.claimRun(), undefined);
        f.store.retryWorkflow("task", before.id);
        const retry = f.store.claimRun()!;
        assert.equal(retry.stepInstructions, run.stepInstructions);
        f.store.finishRun(retry.id, "Complete", role === "review" ? approved : "Fixed");
        assert.equal(f.store.workflowHistory("task")[0].stepId, role === "review" ? "publish" : "review");
      } finally { f.cleanup(); }
    });
  }
}

test("restart recovery preserves the revision position without replaying review", async () => {
  const { spawnSync } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const f = fixture();
  try {
    const first = f.store.claimRun()!;
    f.store.finishRun(first.id, "Complete", changes);
    const child = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import { TaskStore } from ${JSON.stringify(pathToFileURL(join(process.cwd(), "src/server/task-store.ts")).href)};
      const store = new TaskStore(${JSON.stringify(f.path)}); store.claimRun(); store.close();
    `]);
    assert.equal(child.status, 0, child.stderr.toString());
    const reopened = new TaskStore(f.path);
    try {
      await new ExecutionService(reopened, async () => { assert.fail("Must wait for explicit retry"); }).drain();
      const execution = reopened.workflowHistory("task")[0];
      assert.equal(execution.status, "Interrupted");
      assert.equal(execution.steps![0].review!.round, 1);
      assert.equal(execution.steps![0].review!.phase, "revise");
      reopened.retryWorkflow("task", execution.id);
      const resumed = reopened.claimRun()!;
      assert.match(resumed.stepInstructions!, /Fix keyboard focus/);
      reopened.finishRun(resumed.id, "Complete", "Fixed");
      assert.equal(reopened.workflowHistory("task")[0].steps![0].review!.round, 2);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("queued cancellation and stale intervention responses cannot advance a newer execution", () => {
  const f = fixture(1);
  try {
    f.store.stopTask("task");
    assert.equal(f.store.workflowHistory("task")[0].status, "Stopped");
    f.store.runTask("task");
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Complete", changes);
    const request = f.store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    f.store.stopTask("task");
    f.store.runTask("task");
    assert.throws(() => f.store.answerFeedback("task", request.id, "Try again", "additional-round"), /no longer pending/);
    assert.equal(f.store.workflowHistory("task")[0].steps![0].review!.round, 1);
  } finally { f.cleanup(); }
});

test("review definitions default to three rounds and reject invalid limits or unavailable revision agents", () => {
  const f = fixture();
  try {
    const { maxRounds: _, ...withoutLimit } = section;
    void _;
    const saved = f.store.saveWorkflow({ id: "default", name: "Default", steps: [withoutLimit] });
    assert.equal(saved.steps?.[0].kind === "review" && saved.steps[0].maxRounds, 3);
    for (const maxRounds of [0, -1, 1.5, "3"]) {
      assert.throws(() => f.store.saveWorkflow({ id: "invalid", name: "Invalid", steps: [{ ...section, maxRounds }] }), /positive whole/);
    }
    assert.throws(() => f.store.saveWorkflow({ id: "invalid", name: "Invalid", steps: [{ ...section, revisionAgentId: "missing" }] }), /revision agent/);
  } finally { f.cleanup(); }
});

test("review records pin reviewed attempts and nominated revisions across retries and later publications", async () => {
  const { ArtifactStore } = await import("./artifact-store.ts");
  const f = fixture();
  const library = new ArtifactStore(f.path, f.store.workspaceId);
  try {
    const artifact = library.create({ title: "Evidence", type: "text", content: "Version one", creator: "Builder" });
    const pinned = { artifactId: artifact.id, revisionId: artifact.revisionId };
    const first = f.store.claimRun()!;
    f.store.finishRun(first.id, "Complete", changes, undefined, undefined, [pinned]);
    const revision = f.store.claimRun()!;
    f.store.finishRun(revision.id, "Complete", "Fixed", undefined, undefined, [pinned]);
    const review = f.store.claimRun()!;
    f.store.finishRun(review.id, "Failed", "Provider unavailable");
    const handover = f.store.list()[0].comments!.find((comment) => comment.runId === revision.id)!;
    f.store.deleteComment("task", handover.id);
    f.store.retryWorkflow("task", first.workflowExecutionId!);
    const retry = f.store.claimRun()!;
    f.store.finishRun(retry.id, "Complete", approved, undefined, undefined, [pinned]);
    library.revise(artifact.id, { title: "Evidence", type: "text", content: "Version two", creator: "Human" });
    const attempts = f.store.workflowHistory("task")[0].steps![0].review!.attempts;
    assert.equal(attempts.at(-1)!.reviewedRunId, revision.id);
    assert.deepEqual(attempts.at(-1)!.reviewedArtifacts, [pinned]);
    assert.deepEqual(attempts.at(-1)!.artifacts, [pinned]);
  } finally { library.close(); f.cleanup(); }
});

test("task summary exposes the current step, role and round while review is active", () => {
  const f = fixture();
  try {
    const run = f.store.claimRun()!;
    f.store.finishRun(run.id, "Complete", changes);
    assert.deepEqual(f.store.list()[0].workflowProgress, { step: 1, total: 2, round: 1, limit: 3, phase: "revise" });
  } finally { f.cleanup(); }
});
