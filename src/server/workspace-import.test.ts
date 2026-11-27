import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";

test("workspace creation is manual and directs imports to their settings section", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-manual-workspace-"));
  const store = new TaskStore(join(directory, "tasks.sqlite"));
  try {
    const count = store.listWorkspaces().length;
    for (const configuration of [store.exportConfiguration(), store.exportConfiguration(true)]) {
      assert.throws(() => store.createWorkspace("Imported", directory, { configuration }), /Import and export settings/);
    }
    assert.equal(store.listWorkspaces().length, count);
    const workspace = store.createWorkspace("Manual", directory, { columns: ["Ready", "Complete"], starterAgentIds: ["planner"] });
    const created = new TaskStore(store.databasePath, workspace.id);
    try {
      assert.equal(workspace.name, "Manual");
      assert.equal(created.listBoards().length, 1);
      assert.deepEqual(created.listColumns(), ["Ready", "Complete"]);
      assert.equal(created.listAgents().length, 1);
    } finally { created.close(); }
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("workspace file import appends ordered board copies with shared agents and memory atomically", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-full-import-"));
  const database = join(directory, "tasks.sqlite");
  const source = new TaskStore(database);
  const targetWorkspace = source.createWorkspace("Target", directory);
  const target = new TaskStore(database, targetWorkspace.id);
  try {
    source.saveBoard("Planning", source.boardId, "Plan the work");
    source.saveAgent({ id: "shared", name: "Shared agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "read-only" });
    source.assignColumnAgent({ column: "To do", agentId: "shared" });
    const delivery = source.saveBoard("Delivery", undefined, "Build the work");
    source.reorderBoards([delivery.id, source.boardId]);
    const deliveryStore = new TaskStore(database, source.workspaceId, { boardId: delivery.id });
    try {
      deliveryStore.renameColumn("To do", "Ready", "Build only approved tasks.");
      deliveryStore.renameColumn("Done", "Shipped", "Verify the result.", true);
      deliveryStore.assignColumnAgent({ column: "Ready", agentId: "shared" });
      source.changeMemory({ operation: "add", category: "Decisions", title: "Decision", statement: "Keep this decision.", scope: "Workspace", source: "User", reason: "Test" });
      const exported = JSON.parse(JSON.stringify(deliveryStore.exportConfiguration(true)));
      target.saveBoard("Delivery", target.boardId);
      target.save({ id: "existing-task", title: "Keep this task", description: "", status: "To do" });
      const before = target.exportConfiguration(true);
      const assign = target.assignColumnAgent;
      let assignmentCount = 0;
      target.assignColumnAgent = function (input) {
        if (++assignmentCount === 2) throw new Error("Second board failed");
        return assign.call(this, input);
      };
      assert.throws(() => target.importConfiguration(exported), /Second board failed/);
      target.assignColumnAgent = assign;
      assert.equal(target.boardId, targetWorkspace.id);
      assert.deepEqual(target.exportConfiguration(true), before);
      const result = target.importConfiguration(exported);
      assert.equal(result.columns, 8);
      const boards = target.listBoards();
      assert.deepEqual(boards.map(({ name }) => name), ["Delivery", "Delivery (imported 2)", "Planning"]);
      assert.equal(boards[0].id, targetWorkspace.id);
      assert.deepEqual(target.exportConfiguration().columns, before.columns);
      assert.deepEqual(target.exportConfiguration().assignments, before.assignments);
      assert.equal(target.listAgents().length, 1);
      assert.notEqual(target.listAgents()[0].id, "shared");
      const restoredDelivery = new TaskStore(database, target.workspaceId, { boardId: boards[1].id });
      const restoredPlanning = new TaskStore(database, target.workspaceId, { boardId: boards[2].id });
      try {
        assert.equal(restoredDelivery.columnInstructions().Ready, "Build only approved tasks.");
        assert.equal(restoredDelivery.completionColumn(), "Shipped");
        assert.equal(restoredDelivery.listColumnAgents()[0].agentId, restoredPlanning.listColumnAgents()[0].agentId);
        restoredDelivery.importConfiguration(exported);
        assert.equal(restoredDelivery.boardId, boards[1].id);
        assert.equal(target.listBoards().length, 5);
        assert.equal(new Set(target.listBoards().map((board) => board.name)).size, 5);
      } finally { restoredDelivery.close(); restoredPlanning.close(); }
      assert.equal(target.searchMemory().entries.length, 2);
      assert.equal(target.readTask("existing-task")!.status, "To do");
      assert.equal(source.listAgents()[0].id, "shared");
      assert.equal(source.listBoards().length, 2);
      const count = target.listBoards().length;
      for (const mutate of [
        (data: typeof exported) => { data.boards[1].id = data.boards[0].id; },
        (data: typeof exported) => { data.defaultBoardId = "missing"; },
        (data: typeof exported) => { data.boards[0].assignments[0].agentId = "missing"; },
      ]) {
        const invalid = structuredClone(exported);
        mutate(invalid);
        assert.throws(() => target.importConfiguration(invalid));
      }
      assert.throws(() => target.importConfiguration(exported, "replace"), /new copies/);
      assert.equal(target.listBoards().length, count);
    } finally { deliveryStore.close(); }
  } finally {
    target.close();
    source.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
