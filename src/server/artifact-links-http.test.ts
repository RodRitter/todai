import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";
import * as links from "../app/api/artifacts/links/route.ts";
import { GET as list } from "../app/api/artifacts/route.ts";

test("HTTP links enforce workspace ownership and filter by task including historical comment references", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-links-http-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(process.env.TODAI_DB_PATH);
  const artifacts = new ArtifactStore(process.env.TODAI_DB_PATH, tasks.workspaceId);
  const other = tasks.createWorkspace("Other", directory);
  const request = (method: string, data?: unknown, workspace = tasks.workspaceId) => new Request("http://localhost/api/artifacts/links?taskId=one", {
    method, headers: { "X-Todai-Workspace": workspace }, ...(data ? { body: JSON.stringify(data) } : {}),
  });
  try {
    tasks.save({ id: "one", title: "One", description: "", status: "To do", agentStatus: "Not started" });
    const a = artifacts.create({ title: "Evidence", type: "text", creator: "Alice", content: "Evidence" });
    const data = { taskId: "one", artifactId: a.id };
    assert.equal((await links.POST(request("POST", data))).status, 200);
    assert.equal((await links.GET(request("GET")).json())[0].explicit, true);
    assert.equal((await links.POST(request("POST", data, other.id))).status, 400);
    assert.equal((await links.POST(request("POST", {}))).status, 400);
    assert.equal(links.GET(new Request("http://localhost/api/artifacts/links?taskId=one")).status, 403);
    tasks.postComment("one", "Evidence", [{ artifactId: a.id, revisionId: a.revisionId }]);
    assert.equal((await links.DELETE(request("DELETE", data))).status, 200);
    assert.equal((await links.GET(request("GET")).json())[0].explicit, false);
    assert.equal((await list(request("GET")).json())[0].id, a.id);
  } finally {
    artifacts.close(); tasks.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
