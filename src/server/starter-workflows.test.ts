import assert from "node:assert/strict";
import test from "node:test";
import { TaskStore } from "./task-store.ts";

const agent = { id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "", permissions: "workspace-write" };
const task = { id: "one", title: "Work", description: "", status: "To do" };
test("workspace defaults apply only to new tasks and respect explicit overrides", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent(agent);
    store.saveWorkflow({ id: "first", name: "First", agentId: agent.id, instructions: "" });
    store.saveWorkflow({ id: "second", name: "Second", agentId: agent.id, instructions: "" });
    store.save(task);
    store.setDefaultWorkflow("first");
    assert.equal(store.save({ ...task, id: "new" }).workflowId, "first");
    assert.equal(store.save(task).workflowId, null);
    assert.equal(store.save({ ...task, id: "override", workflowId: "second" }).workflowId, "second");
    assert.equal(store.save({ ...task, id: "none", workflowId: null }).workflowId, null);
    store.runTask("new");
    store.setDefaultWorkflow("second");
    assert.equal(store.save({ ...task, id: "later" }).workflowId, "second");
    assert.equal(store.workflowHistory("new")[0].workflow.id, "first");
    assert.equal(store.save({ ...task, id: "none" }).workflowId, null);
    assert.throws(() => store.setDefaultWorkflow("missing"), /available workflow/);
    store.deleteAgent(agent.id);
    assert.equal(store.getDefaultWorkflow().available, false);
    assert.equal(store.save({ ...task, id: "missing-agent" }).workflowId, null);
    store.setDefaultWorkflow(null);
    assert.equal(store.getDefaultWorkflow().workflowId, null);
  } finally { store.close(); }
});

test("starter templates stay editable and use the ordinary simple and iterative execution paths", async () => {
  const { starterWorkflow } = await import("../domain/workflow-templates.ts");
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent(agent);
    for (const template of ["single", "implement-review", "plan-implement-review"] as const) {
      const workflow = starterWorkflow(template, template, { implementer: agent.id, reviewer: agent.id, planner: agent.id }, store.listColumns());
      store.saveWorkflow(workflow);
      store.save({ ...task, id: template, workflowId: template });
      store.runTask(template);
      const first = store.claimRun()!;
      store.finishRun(first.id, "Complete", "Work ready");
      if (template === "single") assert.equal(store.workflowHistory(template)[0].status, "Complete");
      else {
        if (template === "plan-implement-review") {
          assert.equal(store.claimRun(), undefined);
          const pending = store.list().find((item) => item.id === template)!.comments!.find((item) => item.feedbackStatus === "pending")!;
          store.answerFeedback(template, pending.id, "Plan accepted", "approve");
          store.finishRun(store.claimRun()!.id, "Complete", "Implemented");
        }
        const review = store.claimRun()!;
        store.finishRun(review.id, "Complete", JSON.stringify({ outcome: "changes-requested", findings: "Fix the bug", findingUpdates: [{ id: "bug", body: "Bug", status: "outstanding", note: "Reproduced" }] }));
        store.finishRun(store.claimRun()!.id, "Complete", "Fixed");
        store.finishRun(store.claimRun()!.id, "Complete", JSON.stringify({ outcome: "approved", findings: "Verified", findingUpdates: [{ id: "bug", status: "resolved", note: "Verified" }] }));
        assert.equal(store.workflowHistory(template)[0].status, "Waiting");
        const pending = store.list().find((item) => item.id === template)!.comments!.find((item) => item.feedbackStatus === "pending")!;
        store.answerFeedback(template, pending.id, "Accepted", "approve");
        assert.equal(store.workflowHistory(template)[0].status, "Complete");
      }
      store.saveWorkflow({ ...workflow, name: "Customized", steps: [{ id: "custom", agentId: agent.id, instructions: "My instructions" }] });
      assert.equal(store.listWorkflows().find((item) => item.id === template)!.name, "Customized");
      assert.notEqual(store.workflowHistory(template)[0].workflow.name, "Customized");
    }
    assert.equal(store.listAgents().length, 1);
    assert.throws(() => store.saveWorkflow(starterWorkflow("single", "unconfigured", {}, ["Backlog"])), /existing agent/);
  } finally { store.close(); }
});
