import assert from "node:assert/strict";
import { test } from "node:test";
import { agentPrompt } from "./agent-prompt.ts";
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
      assert.match(prompt, /Require approval before edits:/);
      assert.match(prompt, /explicit affirmative Human answer/);
      assert.match(prompt, /Unanswered or cancelled requests provide no approval/);
    }
    assert.doesNotMatch(agentPrompt({ ...request, run: { ...run, profile: { ...run.profile, requireApprovalBeforeEdits: false } } }), /Require approval before edits:/);
  } finally { store.close(); }
});
