import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";

test("workspace creation imports configuration atomically and restores the source scope", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-workspace-import-"));
  const database = join(directory, "tasks.sqlite");
  const store = new TaskStore(database);
  try {
    store.saveAgent({ id: "source-agent", name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "read-only" });
    store.assignColumnAgent({ column: "To do", agentId: "source-agent" });
    const source = store.exportConfiguration();
    const sourceId = store.workspaceId;
    const workspace = store.createWorkspace("Imported", directory, { configuration: source });
    const imported = new TaskStore(database, workspace.id);
    try {
      assert.deepEqual(imported.listColumns(), store.listColumns());
      assert.equal(imported.listAgents().length, 1);
      assert.notEqual(imported.listAgents()[0].id, "source-agent");
      assert.equal(imported.listColumnAgents()[0].agentId, imported.listAgents()[0].id);
    } finally { imported.close(); }
    assert.equal(store.workspaceId, sourceId);
    assert.equal(store.boardId, sourceId);
    assert.deepEqual(store.exportConfiguration(), source);
    const count = store.listWorkspaces().length;
    assert.throws(() => store.createWorkspace("Invalid", directory, { configuration: { ...source, version: 9 } }));
    assert.equal(store.listWorkspaces().length, count);

    // Force a failure after the workspace row is inserted to check transaction rollback.
    const original = store.saveAgent;
    store.saveAgent = () => { throw new Error("Import failed"); };
    assert.throws(() => store.createWorkspace("Failed", directory, { configuration: source }), /Import failed/);
    store.saveAgent = original;
    assert.equal(store.listWorkspaces().length, count);
    assert.equal(store.workspaceId, sourceId);
    assert.deepEqual(store.exportConfiguration(), source);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("new workspace import restores every exported board", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-board-import-"));
  const database = join(directory, "tasks.sqlite");
  const store = new TaskStore(database);
  try {
    store.saveBoard("Planning", store.boardId);
    store.saveBoard("Delivery", undefined, "Implementation work");
    const configuration = store.exportConfiguration(true);
    const workspace = store.createWorkspace("Imported", directory, { configuration });
    const imported = new TaskStore(database, workspace.id);
    try {
      assert.deepEqual(imported.listBoards().map(({ name }) => name), ["Planning", "Delivery"]);
    } finally { imported.close(); }
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("full workspace exports restore ordered board settings and shared agents without starter setup", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-full-import-"));
  const database = join(directory, "tasks.sqlite");
  const source = new TaskStore(database);
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
      assert.equal(exported.boards.length, 2);
      assert.equal(deliveryStore.boardId, delivery.id);
      const before = source.listWorkspaces().length;
      assert.throws(() => source.createWorkspace("Mixed", directory, { configuration: exported, starterAgentIds: ["planner"] }), /import or manual/);
      assert.throws(() => source.createWorkspace("Mixed", directory, { configuration: exported, columns: ["Manual"] }), /import or manual/);
      assert.equal(source.listWorkspaces().length, before);
      const assign = source.assignColumnAgent;
      let assignmentCount = 0;
      source.assignColumnAgent = function (input) {
        if (++assignmentCount === 2) throw new Error("Second board failed");
        return assign.call(this, input);
      };
      assert.throws(() => source.createWorkspace("Failed import", directory, { configuration: exported }), /Second board failed/);
      source.assignColumnAgent = assign;
      assert.equal(source.listWorkspaces().length, before);
      assert.equal(source.boardId, source.workspaceId);
      assert.equal(source.listAgents().length, 1);
      const workspace = source.createWorkspace("Imported", directory, { configuration: exported });
      const target = new TaskStore(database, workspace.id);
      try {
        const boards = target.listBoards();
        assert.deepEqual(boards.map(({ name, description, columns }) => ({ name, description, columns })), source.listBoards().map(({ name, description, columns }) => ({ name, description, columns })));
        assert.equal(boards.find((board) => board.name === "Planning")!.id, workspace.id);
        assert.equal(target.listAgents().length, 1);
        assert.notEqual(target.listAgents()[0].id, "shared");
        const restoredDelivery = new TaskStore(database, workspace.id, { boardId: boards[0].id });
        try {
          assert.equal(restoredDelivery.columnInstructions().Ready, "Build only approved tasks.");
          assert.equal(restoredDelivery.completionColumn(), "Shipped");
          assert.equal(restoredDelivery.listColumnAgents()[0].agentId, target.listColumnAgents()[0].agentId);
        } finally { restoredDelivery.close(); }
        assert.equal(target.searchMemory().entries.length, 1);
        assert.equal(source.workspaceId, exported.defaultBoardId);
        assert.equal(source.listAgents()[0].id, "shared");
      } finally { target.close(); }

      for (const mutate of [
        (data: typeof exported) => { data.boards[1].id = data.boards[0].id; },
        (data: typeof exported) => { data.defaultBoardId = "missing"; },
        (data: typeof exported) => { data.boards[0].assignments[0].agentId = "missing"; },
      ]) {
        const invalid = structuredClone(exported);
        mutate(invalid);
        assert.throws(() => source.createWorkspace("Invalid", directory, { configuration: invalid }));
      }
      assert.equal(source.listWorkspaces().length, before + 1);
      assert.throws(() => source.importConfiguration(exported), /new workspace/);
    } finally { deliveryStore.close(); }
  } finally {
    source.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
