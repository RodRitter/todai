import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { PUT } from "../app/api/workspace/route.ts";
import { POST as control } from "../app/api/execution/route.ts";
import * as workspaces from "../app/api/workspaces/route.ts";

test("HTTP directory changes require pause and current confirmation; archived workspaces can be restored without selection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-lifecycle-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const request = (body: unknown, selected = true) => new Request("http://localhost/api", {
    method: "POST", headers: selected ? { "X-Todai-Workspace": store.workspaceId } : {}, body: JSON.stringify(body),
  });
  try {
    for (const name of ["first", "second", "third"]) mkdirSync(join(directory, name));
    store.setWorkspacePath(realpathSync(join(directory, "first")));
    store.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "medium", instructions: "", permissions: "workspace-write" });
    store.assignColumnAgent({ column: "To do", agentId: "agent" });
    store.save({ id: "task", title: "Task", description: "", status: "To do", autoRun: true });
    assert.equal((await PUT(request(join(directory, "second")))).status, 409);
    const run = store.claimRun()!;
    store.postComment("task", "@Agent please review later");
    assert.equal((await PUT(request(join(directory, "second")))).status, 409);
    store.stopExecution(run.id);
    store.finishRun(run.id, "Complete", "Stopped");
    assert.equal((await PUT(request(join(directory, "second")))).status, 200);
    const stale = store.executionState().directoryChanges;
    assert.equal((await PUT(request(join(directory, "third")))).status, 200);
    for (const confirmation of [undefined, true, stale]) {
      assert.equal((await control(request({ action: "resume", directoryChanges: confirmation }))).status, 409);
      assert.equal(store.executionState().paused, true);
    }
    assert.equal((await control(request({ action: "resume", directoryChanges: store.executionState().directoryChanges }))).status, 200);
    assert.equal(store.history().find((item) => item.status === "Queued")?.workspacePath, realpathSync(join(directory, "third")));
    assert.equal(store.list()[0].agentStatus, "Stopped");
    assert.equal((await control(request({ action: "pause" }))).status, 200);
    assert.equal(store.executionState().paused, true);
    assert.equal((await workspaces.PATCH(request({ id: store.workspaceId, archived: true }, false))).status, 409);
    store.runTask("task");
    store.resumeExecution();
    for (let pending = store.claimRun(); pending; pending = store.claimRun())
      store.finishRun(pending.id, "Interrupted", "Finished pending work");
    assert.equal((await workspaces.PATCH(request({ id: store.workspaceId, archived: true }, false))).status, 200);
    assert.deepEqual(await workspaces.GET(new Request("http://localhost/api/workspaces")).json(), []);
    assert.equal((await workspaces.GET(new Request("http://localhost/api/workspaces?archived=true")).json()).length, 1);
    assert.equal((await workspaces.PATCH(request({ id: store.workspaceId, archived: false }, false))).status, 200);
    assert.equal((await workspaces.GET(new Request("http://localhost/api/workspaces")).json()).length, 1);
    assert.equal((await workspaces.PATCH(request({ archived: "true" }, false))).status, 400);
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("workspace API saves worktree mode only for the selected workspace", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-worktree-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const { GET, PATCH } = await import("../app/api/workspace/route.ts");
  const request = (workspaceId: string, body?: unknown) => new Request("http://localhost/api/workspace", {
    method: body === undefined ? "GET" : "PATCH", headers: { "X-Todai-Workspace": workspaceId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    const other = store.createWorkspace("Other", directory);
    assert.equal((await GET(request(store.workspaceId)).json()).worktreesEnabled, false);
    assert.equal((await PATCH(request(store.workspaceId, { worktreesEnabled: true }))).status, 200);
    assert.equal((await GET(request(store.workspaceId)).json()).worktreesEnabled, true);
    assert.equal((await GET(request(other.id)).json()).worktreesEnabled, false);
    assert.equal((await PATCH(request(store.workspaceId, { worktreesEnabled: "false" }))).status, 409);
    assert.equal((await PATCH(request(store.workspaceId, { worktreesEnabled: false }))).status, 200);
    assert.equal(store.boardSnapshot().worktreesEnabled, false);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
