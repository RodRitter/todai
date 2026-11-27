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
