import assert from "node:assert/strict";
import { test } from "node:test";
import { agentPrompt } from "./agent-prompt.ts";
import { agentOutputPolicy } from "./agent-output-policy.ts";
import { TaskStore } from "./task-store.ts";

test("edit approval policy follows the run profile for task and reply runs", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent({ id: "fixer", name: "Fixer", tool: "codex", model: "test", effort: "high", permissions: "workspace-write", instructions: "Fix bugs", requireApprovalBeforeEdits: true });
    store.assignColumnAgent({ column: "In progress", agentId: "fixer" });
    const task = store.save({ id: "task", title: "Bug", description: "", status: "In progress", autoRun: true });
    const run = store.history(task.id)[0];
    assert.ok(run);
    const request = { run, task, workspace: "/tmp", signal: new AbortController().signal, onStart: () => {} };
    for (const kind of [undefined, "reply"] as const) {
      const prompt = agentPrompt({ ...request, run: { ...run, kind } });
      assert.ok(prompt.includes(agentOutputPolicy), "task and reply runs include the shared output policy");
      assert.match(prompt, /Require approval before edits:/);
      assert.match(prompt, /explicit affirmative Human answer/);
      assert.match(prompt, /Unanswered or cancelled requests provide no approval/);
    }
    assert.doesNotMatch(agentPrompt({ ...request, run: { ...run, profile: { ...run.profile, requireApprovalBeforeEdits: false } } }), /Require approval before edits:/);
    assert.ok(!agentPrompt({ ...request, run: { ...run, kind: "intent" } }).includes(agentOutputPolicy), "intent classification keeps its machine-readable instructions");
  } finally { store.close(); }
});

test("task, reply, and intent prompts preserve main-comment context instead of flattening replies", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent({ id: "reviewer", name: "Reviewer", tool: "codex", model: "test", effort: "high", permissions: "workspace-write", instructions: "Review" });
    store.assignColumnAgent({ column: "In progress", agentId: "reviewer" });
    const task = store.save({ id: "task", title: "Thread context", description: "", status: "In progress", autoRun: true });
    const run = store.history(task.id)[0];
    const comments = [
      { id: "main", taskId: task.id, authorName: "Reviewer", body: "Use the compact layout?", createdAt: "2026-11-20T10:00:00Z" },
      { id: "other", taskId: task.id, authorName: "Human", body: "Separate topic", createdAt: "2026-11-20T10:01:00Z" },
      { id: "reply", taskId: task.id, parentCommentId: "main", authorName: "Human", body: "Yes, that layout.", createdAt: "2026-11-20T10:02:00Z" },
      { id: "feedback", taskId: task.id, runId: "feedback-run", body: "Proceed?", recommendation: "Proceed with compact layout.", feedbackStatus: "answered" as const, createdAt: "2026-11-20T10:03:00Z" },
      { id: "answer", taskId: task.id, runId: "feedback-run", authorName: "Human", body: "Approved", createdAt: "2026-11-20T10:04:00Z" },
    ];
    const request = { run: { ...run, commentId: "reply" }, task: { ...task, comments }, workspace: "/tmp", signal: new AbortController().signal, onStart: () => {} };
    for (const kind of [undefined, "reply"] as const) {
      const prompt = agentPrompt({ ...request, run: { ...request.run, kind } });
      assert.doesNotMatch(prompt, /Previous task comments \(chronological\)/);
      assert.match(prompt, /replies are nested context belonging only to that main comment/);
      const threads = JSON.parse(prompt.split("Task comment threads:\n")[1].split("\n\nIf you need human feedback")[0]);
      assert.deepEqual(threads.map((thread: { mainComment: { id: string } }) => thread.mainComment.id), ["feedback", "other", "main"]);
      assert.equal(threads[2].replies[0].id, "reply");
      assert.equal(threads[2].replies[0].inReplyTo, "main");
      assert.equal(threads[0].replies[0].id, "answer");
      assert.equal(threads[0].mainComment.feedbackStatus, "answered");
      assert.equal(threads[0].mainComment.recommendation, "Proceed with compact layout.");
      if (kind === "reply") assert.match(prompt, /Target comment ID: reply. Main comment ID: main/);
    }
    const intent = agentPrompt({ ...request, run: { ...request.run, kind: "intent" } });
    const input = JSON.parse(intent.split("\n\n").at(-1)!);
    assert.equal(input.comment, "Yes, that layout.");
    assert.equal(input.contextThread.mainComment.id, "main");
    assert.equal(input.contextThread.replies[0].id, "reply");
    assert.ok(!intent.includes("Separate topic"));
  } finally { store.close(); }
});
