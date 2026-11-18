import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { POST as runTask } from "../app/api/tasks/run/route.ts";
import { GET, PUT } from "../app/api/workflows/route.ts";

test("workflow creation, editing and history are validated and workspace scoped over HTTP", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-workflow-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const workspace = store.createWorkspace("Other", directory);
  const other = new TaskStore(process.env.TODAI_DB_PATH, workspace.id);
  const request = (body?: unknown, workspaceId = store.workspaceId, query = "") => new Request(`http://localhost/api/workflows${query}`, {
    method: body ? "PUT" : "GET", headers: { "X-Todai-Workspace": workspaceId, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const workflow = { id: "workflow", name: "Build", agentId: "builder", instructions: "Verify" };
  try {
    store.saveAgent({ id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "", permissions: "workspace-write" });
    assert.equal((await PUT(request(workflow))).status, 200);
    assert.deepEqual(await GET(request()).json(), [workflow]);
    assert.equal((await PUT(request({ ...workflow, name: "" }))).status, 400);
    assert.equal((await PUT(request(workflow, other.workspaceId))).status, 400);
    assert.deepEqual(await GET(request(undefined, other.workspaceId)).json(), []);
    assert.throws(() => other.save({ id: "foreign-task", title: "Other", description: "", status: "To do", workflowId: "workflow" }), /existing workflow/);
    store.save({ id: "task", title: "Build", description: "", status: "To do", workflowId: "workflow" });
    store.pauseExecution();
    const runRequest = (workspaceId = store.workspaceId) => new Request("http://localhost/api/tasks/run", {
      method: "POST", headers: { "X-Todai-Workspace": workspaceId }, body: JSON.stringify({ taskId: "task" }),
    });
    assert.equal((await runTask(runRequest())).status, 200);
    assert.equal((await runTask(runRequest())).status, 409);
    assert.equal((await runTask(runRequest(other.workspaceId))).status, 400);
    assert.equal((await PUT(request({ ...workflow, instructions: "Updated" }))).status, 200);
    const [execution] = await GET(request(undefined, store.workspaceId, "?taskId=task")).json();
    assert.equal(execution.workflow.instructions, "Verify");
    assert.equal(execution.status, "Queued");
    assert.equal(GET(request(undefined, other.workspaceId, "?taskId=task")).status, 400);
    assert.equal(GET(new Request("http://localhost/api/workflows")).status, 400);
    store.deleteAgent("builder");
    store.stopTask("task");
    assert.throws(() => store.runTask("task"), /existing agent/);
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    store.close(); other.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
