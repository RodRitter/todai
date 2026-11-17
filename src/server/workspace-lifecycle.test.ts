import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";

test("archival rejects pending work and restoration preserves the last workspace and its data", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-archive-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  try {
    store.setWorkspacePath(directory);
    store.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "Keep", permissions: "workspace-write" });
    store.assignColumnAgent({ column: "To do", agentId: "agent" });
    store.save({ id: "task", title: "Task", description: "Keep description", status: "To do", autoRun: true });
    assert.throws(() => store.setWorkspaceArchived(store.workspaceId, true), /queued/i);
    const run = store.claimRun()!;
    assert.throws(() => store.setWorkspaceArchived(store.workspaceId, true), /running/i);
    store.finishRun(run.id, "Complete", "Keep handover");
    store.setDefaultExecutor("claude");
    const board = store.boardSnapshot();
    const history = store.history();
    const config = store.exportConfiguration();
    store.setWorkspaceArchived(store.workspaceId, true);
    assert.deepEqual(store.listWorkspaces(), []);
    assert.equal(store.listArchivedWorkspaces()[0].id, store.workspaceId);
    assert.equal(existsSync(directory), true);
    assert.throws(() => new TaskStore(path, store.workspaceId), /archived/i);
    assert.throws(() => store.runTask("task"), /archived/i);
    const registry = new TaskStore(path);
    try {
      assert.deepEqual(registry.listWorkspaces(), []);
      registry.setWorkspaceArchived(store.workspaceId, false);
    } finally { registry.close(); }
    assert.equal(store.listWorkspaces()[0].id, store.workspaceId);
    assert.deepEqual(store.boardSnapshot(), board);
    assert.deepEqual(store.history(), history);
    assert.deepEqual(store.exportConfiguration(), config);
    assert.equal(store.getDefaultExecutor(), "claude");
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
