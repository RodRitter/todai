import assert from "node:assert/strict";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { GET, POST } from "../app/api/workspaces/route.ts";

test("workspace HTTP creation validates input and starts an independent default board", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-workspaces-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const first = new TaskStore(process.env.TODAI_DB_PATH);
  try {
    first.renameColumn("To do", "Custom");
    first.setDefaultExecutor("claude");
    first.save({ id: "original", title: "Keep", description: "", status: "Custom" });
    const create = (body: unknown) => POST(new Request("http://localhost/api/workspaces", {
      method: "POST", body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "X-Todai-Workspace": first.workspaceId },
    }));
    for (const body of [null, {}, { name: 12, path: directory }, { name: " ", path: directory }, { name: "New", path: join(directory, "missing") }]) {
      assert.equal((await create(body)).status, 400);
    }
    const response = await create({ name: " Second ", path: directory });
    assert.equal(response.status, 201);
    const workspace = await response.json();
    assert.equal(workspace.name, "Second");
    assert.equal(workspace.path, realpathSync(directory));
    const second = new TaskStore(process.env.TODAI_DB_PATH, workspace.id);
    try {
      assert.deepEqual(second.list(), []);
      assert.deepEqual(second.listAgents(), []);
      assert.deepEqual(second.listColumnAgents(), []);
      assert.deepEqual(second.listColumns(), ["To do", "In progress", "In review", "Done"]);
      assert.equal(second.getDefaultExecutor(), "codex");
      assert.equal(first.list()[0].title, "Keep");
      assert.equal(first.getDefaultExecutor(), "claude");
      assert.deepEqual(await GET().json(), [{ ...first.getWorkspace() }, workspace]);
    } finally { second.close(); }
  } finally {
    first.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
