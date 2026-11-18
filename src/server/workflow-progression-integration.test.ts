import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";

test("completion and feedback stay atomic and workspace scoped while other work is queued", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-progression-"));
  const path = join(directory, "tasks.sqlite");
  const first = new TaskStore(path);
  const second = new TaskStore(path, first.createWorkspace("Second", directory).id);
  try {
    for (const [index, store] of [first, second].entries()) {
      store.saveAgent({ id: `agent-${index}`, name: "Builder", tool: "codex", model: "original", effort: "high", instructions: "", permissions: "workspace-write" });
      for (const column of ["In progress", "In review"])
        store.assignColumnAgent({ column, agentId: `agent-${index}` });
      store.save({ id: `task-${index}`, title: "Build", description: "", status: "In progress", autoWorkflow: true, autoRun: true });
    }
    const waiting = first.claimRun()!;
    first.finishRun(waiting.id, "Waiting", "Proceed?", "Yes");
    const request = first.list()[0].comments![0];
    assert.throws(() => second.answerFeedback(waiting.taskId, request.id, "Yes"), /workspace/i);
    const foreignRun = second.claimRun()!;
    const before = second.boardSnapshot();
    first.answerFeedback(waiting.taskId, request.id, "Yes");
    assert.throws(() => first.answerFeedback(waiting.taskId, request.id, "Again"), /no longer pending/);
    first.finishRun(waiting.id, "Complete", "Duplicate");
    assert.equal(first.history().length, 2);
    assert.equal(first.list()[0].status, "In progress");
    assert.equal(first.claimRun(), undefined);
    assert.deepEqual(second.boardSnapshot(), before);
    second.finishRun(foreignRun.id, "Complete", "Second built");
    const resumed = first.claimRun()!;
    assert.equal(resumed.profile.model, "original");
    assert.equal(resumed.createdAt, waiting.createdAt);
    // Invalid handover evidence must roll back completion AND its progression.
    assert.throws(() => first.finishRun(resumed.id, "Complete", "Built", undefined, undefined, [{ artifactId: "missing", revisionId: "missing" }]), /revision not found/);
    assert.equal(first.history().find((run) => run.id === resumed.id)!.status, "Running");
    assert.equal(first.list()[0].status, "In progress");
    assert.equal(first.history().length, 2);
    first.finishRun(resumed.id, "Complete", "Built");
    first.finishRun(resumed.id, "Complete", "Duplicate");
    assert.equal(first.list()[0].status, "In review");
    assert.equal(first.history().filter((run) => run.status === "Queued").length, 1);
    assert.equal(first.list()[0].comments!.filter((comment) => comment.body === "Built").length, 1);
    assert.equal(second.list()[0].status, "In review");
    assert.equal(second.history().filter((run) => run.status === "Queued").length, 1);
  } finally {
    second.close();
    first.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
