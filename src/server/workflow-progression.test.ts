import assert from "node:assert/strict";
import { test } from "node:test";
import { workflowProgression } from "./workflow-progression.ts";
import type { AgentRun } from "./task-store.ts";
import type { Task } from "../domain/task.ts";

const task: Task = { id: "task", title: "Build", description: "", status: "In progress", agentStatus: "Complete", autoWorkflow: true, autoRun: true };
const run: AgentRun = {
  id: "run", taskId: task.id, workspaceId: "workspace", workspacePath: "/project",
  column: task.status, status: "Complete",
  profile: { id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "", permissions: "workspace-write" },
  createdAt: "2026-01-01T00:00:00Z", startedAt: null, finishedAt: null, summary: "Built",
  ownerPid: null, runnerPid: null,
};
const context = { task, run, columns: ["To do", "In progress", "In review", "Done"], hasQueuedRun: false };

test("successful column work advances with automatic execution only when opted in", () => {
  assert.deepEqual(workflowProgression({ ...context, event: "run-finished" }), { action: "advance", column: "In review", autoRun: true });
  assert.deepEqual(workflowProgression({ ...context, task: { ...task, autoRun: false }, event: "run-finished" }), { action: "advance", column: "In review", autoRun: false });
});

test("ordered replies continue after success or reply failure without advancing the column", () => {
  const reviewer = { ...run.profile, id: "reviewer", name: "Reviewer" };
  for (const [kind, status] of [["intent", "Complete"], ["reply", "Complete"], ["reply", "Failed"]] as const) {
    assert.deepEqual(workflowProgression({ ...context, event: "run-finished", run: { ...run, kind, status, commentId: "comment", replyPlan: [reviewer, run.profile] } }), {
      action: "queue", column: "In progress", profile: reviewer, kind: "reply", commentId: "comment", replyPlan: [run.profile], createdAt: run.createdAt,
    });
  }
});

test("human feedback resumes the same profile and reply plan even with other queued work", () => {
  const waiting = { ...run, status: "Waiting" as const, kind: "reply" as const, commentId: "comment", replyPlan: [run.profile] };
  assert.deepEqual(workflowProgression({ event: "feedback-answered", task, run: waiting }), {
    action: "queue", column: "In progress", profile: run.profile, kind: "reply", commentId: "comment", replyPlan: [run.profile], createdAt: run.createdAt,
  });
});

test("unfinished, unsuccessful, waiting, redirected, or already queued work does not advance", () => {
  for (const status of ["Queued", "Running", "Failed", "Interrupted", "Stopped", "Waiting"] as const) {
    for (const kind of [null, "intent", "reply"] as const) {
      // Failed replies can continue a reply plan, but never advance a column.
      assert.deepEqual(workflowProgression({ ...context, event: "run-finished", run: { ...run, status, kind } }), { action: "wait" });
    }
  }
  for (const change of [
    { hasQueuedRun: true },
    { task: { ...task, autoWorkflow: false } },
    { task: { ...task, status: "Done" } },
    { columns: ["To do", "In progress"] },
    { columns: ["To do", "Done"] },
    { run: { ...run, kind: "reply" as const } },
  ]) {
    assert.deepEqual(workflowProgression({ ...context, ...change, event: "run-finished" }), { action: "wait" });
  }
});

test("an explicit empty intent reply plan overrides nominated agents", () => {
  assert.deepEqual(workflowProgression({ ...context, event: "run-finished", run: { ...run, kind: "intent", replyPlan: [run.profile] }, replyPlan: [] }), { action: "wait" });
});
