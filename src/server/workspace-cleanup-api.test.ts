import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { GET, POST } from "../app/api/workspace-cleanup/route.ts";

test("cleanup HTTP requires workspace scope, a valid preview, and unchanged records", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-cleanup-api-"));
  const previous = process.env.TODAI_DB_PATH;
  const path = join(directory, "tasks.sqlite");
  process.env.TODAI_DB_PATH = path;
  const store = new TaskStore(path);
  const db = new DatabaseSync(path);
  const request = (body?: unknown, workspace = store.workspaceId) => new Request("http://localhost/api/workspace-cleanup", {
    method: body === undefined ? "GET" : "POST", headers: workspace ? { "X-Todai-Workspace": workspace } : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    store.save({ id: "old", title: "Old", description: "", status: "Done" });
    db.exec("UPDATE tasks SET archivedAt = '2020-01-01' WHERE id = 'old'");
    assert.equal(GET(request(undefined, "")).status, 409);
    assert.equal((await POST(request({}))).status, 400);
    assert.equal((await POST(new Request("http://localhost/api/workspace-cleanup", { method: "POST", body: "{" }))).status, 400);
    const preview = await GET(request()).json();
    assert.equal(preview.counts.task, 1);
    const other = store.createWorkspace("Other", directory);
    assert.equal((await POST(request(preview, other.id))).status, 409);
    // Workspace creation invalidates the old preview even though the candidate is unchanged.
    assert.equal((await POST(request(preview))).status, 409);
    const fresh = await GET(request()).json();
    const response = await POST(request(fresh));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).counts.task, 1);
    assert.equal((await POST(request(fresh))).status, 409);
    assert.equal(db.prepare("SELECT count(*) n FROM tasks WHERE id = 'old'").get()!.n, 0);
  } finally {
    db.close(); store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
