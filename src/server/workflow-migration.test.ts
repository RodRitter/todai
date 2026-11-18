import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { workflowSteps } from "../domain/workflow.ts";

const agent = { id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build", permissions: "workspace-write" };
const task = { id: "task", title: "Existing work", description: "Keep this", status: "To do" };

test("conversion preserves custom placement, ordered agents, manual continuation, and unassigned tasks without starting work", () => {
  const store = new TaskStore(":memory:");
  try {
    store.renameColumn("To do", "Ideas");
    store.saveAgent(agent);
    store.saveAgent({ ...agent, id: "reviewer", name: "Reviewer" });
    store.assignColumnAgent({ column: "Ideas", agentId: "builder" });
    store.assignColumnAgent({ column: "In review", agentId: "reviewer" });
    store.save({ ...task, status: "Ideas" });
    store.save({ ...task, id: "unassigned", status: "Done" });
    const report = store.migrateColumnAutomation();
    assert.equal(report.state, "complete");
    assert.deepEqual(report.affectedTaskIds, ["task"]);
    assert.equal(store.list()[0].status, "Ideas");
    assert.equal(store.list()[1].workflowId, null);
    const workflow = store.listWorkflows().find((item) => item.id === store.list()[0].workflowId)!;
    assert.deepEqual(workflowSteps(workflow).filter((step) => step.kind !== "checkpoint").map((step) => step.agentId), ["builder", "reviewer"]);
    assert.equal(workflowSteps(workflow).filter((step) => step.kind === "checkpoint").length, 1);
    assert.deepEqual(store.history(), []);
    assert.deepEqual(store.listColumnAgents(), []);
    assert.deepEqual(store.migrateColumnAutomation(), report);
    assert.equal(store.listWorkflows().length, 1);
  } finally { store.close(); }
});

for (const autoRun of [false, true]) for (const autoWorkflow of [false, true]) {
  test(`legacy continuation survives conversion: autoRun=${autoRun}, autoWorkflow=${autoWorkflow}`, () => {
    const store = new TaskStore(":memory:");
    try {
      store.saveAgent(agent);
      store.assignColumnAgent({ column: "To do", agentId: "builder" });
      store.assignColumnAgent({ column: "In progress", agentId: "builder" });
      store.save({ ...task, autoRun, autoWorkflow });
      if (autoRun) {
        const before = store.list();
        assert.equal(store.migrateColumnAutomation().state, "blocked");
        assert.deepEqual(store.list(), before);
        store.stopTask(task.id);
      }
      assert.equal(store.migrateColumnAutomation().state, "complete");
      store.runTask(task.id);
      const run = store.claimRun()!;
      store.finishRun(run.id, "Complete", "Built");
      assert.equal(store.list()[0].agentStatus, autoRun && autoWorkflow ? "Queued" : "Waiting");
      const moved = { ...store.list()[0], status: "Done", autoRun: true, autoWorkflow: true };
      assert.throws(() => store.save(moved), /Stop.*before moving/);
      store.stopTask(task.id);
      store.save(moved);
      assert.equal(store.list()[0].status, "Done");
      assert.equal(store.history().some((item) => item.status === "Queued"), false);
      assert.throws(() => store.assignColumnAgent({ column: "Done", agentId: "builder" }), /workflow/i);
      store.save({ ...task, id: "unconfigured", autoRun: true });
      assert.throws(() => store.runTask("unconfigured"), /Choose a workflow/);
    } finally { store.close(); }
  });
}

test("workflow milestones distinguish internal review from human review and preserve mapping snapshots", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent(agent);
    store.migrateColumnAutomation();
    const workflow = store.saveWorkflow({ id: "flow", name: "Delivery", steps: [
      { id: "build", agentId: "builder", instructions: "Build" },
      { id: "review", kind: "review", agentId: "builder", revisionAgentId: "builder", instructions: "Review", revisionInstructions: "Revise", maxRounds: 2 },
      { id: "approve", kind: "checkpoint", instructions: "Approve delivery" },
    ] });
    assert.deepEqual(workflow.statusMappings, { todo: "To do", inProgress: "In progress", inReview: "In review", done: "Done" });
    store.save({ ...task, workflowId: workflow.id });
    store.runTask(task.id);
    assert.equal(store.list()[0].status, "In progress");
    let run = store.claimRun()!;
    assert.throws(() => store.save({ ...store.list()[0], status: "Done" }), /Stop.*before moving/);
    store.finishRun(run.id, "Complete", "Built");
    assert.equal(store.list()[0].status, "In progress");
    store.saveWorkflow({ ...workflow, statusMappings: { todo: null, inProgress: null, inReview: null, done: null } });
    run = store.claimRun()!;
    store.finishRun(run.id, "Complete", JSON.stringify({ outcome: "approved", findings: "Verified" }));
    assert.equal(store.list()[0].status, "In review");
    const question = store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    store.answerFeedback(task.id, question.id, "Approved", "approve");
    assert.equal(store.list()[0].status, "Done");
    assert.equal(store.list()[0].workflowActive, false);
  } finally { store.close(); }
});

test("version two configuration round-trips workflows and milestones and rejects dangling references atomically", () => {
  const source = new TaskStore(":memory:");
  const target = new TaskStore(":memory:");
  try {
    source.saveAgent(agent);
    source.migrateColumnAutomation();
    target.migrateColumnAutomation();
    source.saveWorkflow({ id: "flow", name: "Build", agentId: "builder", instructions: "Build it" });
    const data = source.exportConfiguration();
    assert.equal(data.version, 2);
    assert.equal(data.workflows?.length, 1);
    target.importConfiguration(data, "replace", "overwrite");
    assert.deepEqual(target.exportConfiguration(), data);
    for (const invalid of [
      { ...data, agents: [] },
      { ...data, columns: [] },
      { ...data, workflows: [{ ...data.workflows![0], statusMappings: { done: "Missing" } }] },
    ]) {
      assert.throws(() => target.importConfiguration(invalid), /agent|status|column/i);
      assert.deepEqual(target.exportConfiguration(), data);
    }
    target.importConfiguration(data);
    const copy = target.listWorkflows()[1];
    assert.notEqual(copy.id, "flow");
    assert.notEqual(workflowSteps(copy)[0].agentId, "builder");
    assert.equal(copy.statusMappings?.done, "Done (imported 2)");
  } finally { source.close(); target.close(); }
});

test("legacy imports become explicit manual pipelines and cannot bypass pending-work protection", () => {
  const source = new TaskStore(":memory:");
  const target = new TaskStore(":memory:");
  try {
    source.saveAgent(agent);
    source.assignColumnAgent({ column: "To do", agentId: "builder" });
    source.assignColumnAgent({ column: "In review", agentId: "builder" });
    const legacy = source.exportConfiguration();
    target.migrateColumnAutomation();
    target.importConfiguration(legacy);
    assert.equal(target.listWorkflows().length, 1);
    assert.deepEqual(workflowSteps(target.listWorkflows()[0]).map((step) => step.kind ?? "agent"), ["agent", "checkpoint", "agent"]);
    assert.deepEqual(target.listColumnAgents(), []);
    assert.deepEqual(target.history(), []);
    source.save({ ...task, autoRun: true });
    assert.throws(() => source.importConfiguration(legacy), /queued|running/i);
    const run = source.claimRun()!;
    assert.equal(source.migrateColumnAutomation().state, "blocked");
    source.finishRun(run.id, "Complete", "Finished legacy work");
    const history = source.history();
    assert.equal(source.migrateColumnAutomation().state, "complete");
    assert.deepEqual(source.history(), history);
  } finally { source.close(); target.close(); }
});

test("custom boards require explicit milestone choices and mapped columns cannot become dangling", () => {
  const store = new TaskStore(":memory:");
  try {
    for (const column of store.listColumns()) store.renameColumn(column, `Custom ${column}`);
    store.saveAgent(agent);
    store.migrateColumnAutomation();
    let workflow = store.saveWorkflow({ id: "custom", name: "Custom", agentId: "builder", instructions: "Build" });
    store.save({ ...task, status: "Custom To do", workflowId: workflow.id });
    assert.throws(() => store.runTask(task.id), /milestone/);
    workflow = store.saveWorkflow({ ...workflow, statusMappings: { todo: null, inProgress: "Custom In progress", inReview: null, done: "Custom Done" } });
    assert.throws(() => store.deleteColumn("Custom Done"), /milestone/i);
    store.runTask(task.id);
    const run = store.claimRun()!;
    store.renameColumn("Custom Done", "Delivered");
    store.finishRun(run.id, "Complete", "Built");
    assert.equal(store.list()[0].status, "Delivered");
    assert.equal(store.listWorkflows()[0].statusMappings?.done, "Delivered");
    const data = store.exportConfiguration();
    assert.throws(() => store.importConfiguration({ ...data, workflows: [], columns: [data.columns[0]] }, "replace"), /milestone/i);
    assert.deepEqual(store.exportConfiguration(), data);
  } finally { store.close(); }
});

test("conversion rolls back on storage failure and survives reopening without duplicate workflows", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-migration-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  try {
    store.saveAgent(agent);
    store.assignColumnAgent({ column: "To do", agentId: "builder" });
    store.save(task);
    const before = store.list();
    const db = new DatabaseSync(path);
    db.exec("CREATE TRIGGER reject_conversion BEFORE DELETE ON column_assignments BEGIN SELECT RAISE(ABORT, 'conversion failed'); END");
    assert.throws(() => store.migrateColumnAutomation(), /conversion failed/);
    assert.deepEqual(store.list(), before);
    assert.deepEqual(store.listWorkflows(), []);
    assert.equal(store.listColumnAgents().length, 1);
    db.exec("DROP TRIGGER reject_conversion");
    db.close();
    const report = store.migrateColumnAutomation();
    const configuration = store.exportConfiguration();
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.migrateColumnAutomation(), report);
    assert.deepEqual(store.exportConfiguration(), configuration);
    assert.deepEqual(store.history(), []);
    const secondWorkspace = store.createWorkspace("Other", directory);
    const second = new TaskStore(path, secondWorkspace.id);
    try {
      assert.deepEqual(second.migrateColumnAutomation().affectedTaskIds, []);
      assert.deepEqual(second.listWorkflows(), []);
    } finally { second.close(); }
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("selecting a workflow applies its ready milestone without starting work", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent(agent);
    store.migrateColumnAutomation();
    store.saveWorkflow({ id: "flow", name: "Build", agentId: "builder", instructions: "Build" });
    store.save({ ...task, status: "Done" });
    const selected = store.save({ ...store.list()[0], workflowId: "flow" });
    assert.equal(selected.status, "To do");
    assert.deepEqual(store.history(), []);
  } finally { store.close(); }
});

test("automatic legacy pipelines keep a human boundary across an unassigned column", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent(agent);
    store.assignColumnAgent({ column: "To do", agentId: "builder" });
    store.assignColumnAgent({ column: "In review", agentId: "builder" });
    store.save({ ...task, autoRun: true, autoWorkflow: true });
    store.stopTask(task.id);
    store.migrateColumnAutomation();
    store.runTask(task.id);
    const run = store.claimRun()!;
    store.finishRun(run.id, "Complete", "Built");
    assert.equal(store.list()[0].agentStatus, "Waiting");
    assert.equal(store.claimRun(), undefined);
    const question = store.list()[0].comments!.find((item) => item.feedbackStatus === "pending")!;
    store.answerFeedback(task.id, question.id, "Continue", "approve");
    assert.equal(store.list()[0].agentStatus, "Queued");
  } finally { store.close(); }
});
