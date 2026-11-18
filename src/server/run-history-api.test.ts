import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { GET } from "../app/api/tasks/run/route.ts";

test("run history is workspace-scoped and exposes only display data in newest-first order", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-run-history-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  try {
    store.saveAgent({ id: "agent", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Private instructions", permissions: "workspace-write" });
    store.assignColumnAgent({ column: "In progress", agentId: "agent" });
    store.save({ id: "task", title: "Build", description: "", status: "In progress", autoRun: true });
    const first = store.claimRun()!;
    store.finishRun(first.id, "Complete", "Work completed.");
    store.runTask("task");
    const request = (workspaceId?: string, taskId = "task") => new Request(`http://localhost/api/tasks/run?taskId=${taskId}`, {
      headers: workspaceId ? { "X-Todai-Workspace": workspaceId } : {},
    });
    const response = GET(request(store.workspaceId));
    assert.equal(response.status, 200);
    const history = await response.json();
    assert.deepEqual(history.map((run: { status: string }) => run.status), ["Queued", "Complete"]);
    assert.equal(history[1].summary, "Work completed.");
    assert.equal(history[1].agentName, "Builder");
    assert.deepEqual(Object.keys(history[1]).sort(), ["id", "agentName", "status", "createdAt", "startedAt", "finishedAt", "summary"].sort());
    assert.equal(GET(request()).status, 400);
    assert.deepEqual(await GET(request(store.workspaceId, "missing")).json(), []);
    const other = store.createWorkspace("Other", directory);
    assert.equal(GET(request(other.id)).status, 400);
    assert.equal(GET(new Request("http://localhost/api/tasks/run")).status, 400);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("global queue includes workspace labels and excludes active and finished runs", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-queue-view-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  const workspace = store.createWorkspace("Other", directory);
  const other = new TaskStore(path, workspace.id);
  try {
    for (const [index, current] of [store, other].entries()) {
      current.saveAgent({ id: `agent-${index}`, name: `Agent ${index}`, tool: "codex", model: "test", effort: "high", instructions: "", permissions: "workspace-write" });
      current.assignColumnAgent({ column: "In progress", agentId: `agent-${index}` });
      current.save({ id: `task-${index}`, title: `Task ${index}`, description: "", status: "In progress", autoRun: true });
    }
    const queue = store.executionState().queued!;
    assert.equal(queue.length, 2);
    assert.equal(queue[1].workspaceName, "Other");
    assert.equal(queue[1].agentName, "Agent 1");
    assert.equal(queue[1].held, false);
    const run = other.claimRun()!;
    assert.equal(store.executionState().queued!.length, 1);
    other.stopExecution(run.id);
    other.finishRun(run.id, "Stopped", "Stopped.");
    assert.equal(store.executionState().paused, true);
  } finally { store.close(); other.close(); rmSync(directory, { recursive: true, force: true }); }
});
