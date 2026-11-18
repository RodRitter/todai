import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { POST as runTask } from "../app/api/tasks/run/route.ts";
import { GET, PUT, POST as retryWorkflow } from "../app/api/workflows/route.ts";

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
    assert.deepEqual(await GET(request()).json(), [{ ...workflow, statusMappings: { todo: "To do", inProgress: "In progress", inReview: "In review", done: "Done" } }]);
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

    const steps = [
      { id: "one", agentId: "builder", instructions: "Build" },
      { id: "two", agentId: "builder", instructions: "Review" },
    ];
    for (const invalid of [[], [null], [{ ...steps[0], agentId: "missing" }], [steps[0], steps[0]]]) {
      const response = await PUT(request({ id: "ordered", name: "Ordered", steps: invalid }));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /step/i);
    }
    assert.equal((await PUT(request({ id: "ordered", name: "Ordered", steps }))).status, 200);
    store.save({ id: "ordered-task", title: "Ordered", description: "", status: "To do", workflowId: "ordered" });
    store.runTask("ordered-task");
    const orderedExecution = store.workflowHistory("ordered-task")[0];
    store.stopTask("ordered-task");
    const retryRequest = (workspaceId = store.workspaceId) => new Request("http://localhost/api/workflows", {
      method: "POST", headers: { "X-Todai-Workspace": workspaceId }, body: JSON.stringify({ taskId: "ordered-task", executionId: orderedExecution.id }),
    });
    assert.equal((await retryWorkflow(retryRequest(other.workspaceId))).status, 400);
    assert.equal((await retryWorkflow(retryRequest())).status, 200);
    assert.equal((await retryWorkflow(retryRequest())).status, 409);
    assert.equal(store.executionState().paused, true);
    assert.equal(store.workflowHistory("ordered-task")[0].stepId, "one");
    store.stopTask("ordered-task");
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

test("checkpoint decisions require explicit outcomes and reject stale or foreign HTTP requests", async () => {
  const { POST: answer } = await import("../app/api/tasks/feedback/route.ts");
  const directory = mkdtempSync(join(tmpdir(), "todai-checkpoint-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  try {
    const other = store.createWorkspace("Other", directory);
    store.saveWorkflow({ id: "approval", name: "Approval", steps: [{ id: "review", kind: "checkpoint", instructions: "Review work" }] });
    store.save({ id: "task", title: "Review", description: "", status: "To do", workflowId: "approval" });
    store.runTask("task");
    const pending = store.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
    const request = (decision?: string, workspaceId = store.workspaceId) => new Request("http://localhost/api/tasks/feedback", {
      method: "POST", headers: { "X-Todai-Workspace": workspaceId }, body: JSON.stringify({ taskId: "task", commentId: pending.id, body: "Reviewed", decision }),
    });
    assert.equal((await answer(request())).status, 409);
    assert.equal((await answer(request("approve", other.id))).status, 400);
    assert.equal((await answer(request("approve"))).status, 200);
    assert.equal(store.workflowHistory("task")[0].status, "Complete");
    store.runTask("task");
    assert.equal((await answer(request("approve"))).status, 409);
    assert.equal(store.workflowHistory("task")[0].status, "Waiting");
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
