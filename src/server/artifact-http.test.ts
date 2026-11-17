import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import * as api from "../app/api/artifacts/route.ts";
import { GET as download } from "../app/api/artifacts/download/route.ts";

test("HTTP publication, history, exact downloads and archival retain workspace boundaries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifact-http-"));
  const previousPath = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(process.env.TODAI_DB_PATH);
  const workspaceId = tasks.workspaceId;
  const other = tasks.createWorkspace("Other", directory);
  tasks.close();
  const request = (query = "", init: RequestInit = {}, owner = workspaceId) => new Request(`http://localhost/api/artifacts${query}`, { ...init, headers: { "X-Todai-Workspace": owner } });
  const publish = (content: string, id?: string) => {
    const form = new FormData();
    Object.entries({ title: content, content, type: "text", creator: "Alice" }).forEach(([key, value]) => form.set(key, value));
    if (id) form.set("id", id);
    return api.POST(request("", { method: "POST", body: form }));
  };
  try {
    const firstResponse = await publish("Original");
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();
    const second = await (await publish("Updated", first.id)).json();
    assert.equal(second.id, first.id);
    assert.equal(second.revisionNumber, 2);
    assert.equal(await download(request(`?id=${first.id}&revision=${first.revisionId}`)).text(), "Original");
    assert.deepEqual(await api.GET(request(`?id=${first.id}&revision=${first.revisionId}`)).json(), first);
    assert.equal((await api.GET(request(`?id=${first.id}&history=true`)).json()).length, 2);
    assert.equal(api.GET(request(`?id=${first.id}&history=true`, {}, other.id)).status, 400);
    assert.equal(download(request(`?id=${first.id}&revision=missing`)).status, 400);
    const archived = await api.PATCH(request("", { method: "PATCH", body: JSON.stringify({ id: first.id }) }));
    assert.equal(archived.status, 200);
    assert.deepEqual(await api.GET(request()).json(), []);
    assert.equal((await api.GET(request("?archived=true")).json()).length, 1);
    assert.equal(await download(request(`?id=${first.id}&revision=${first.revisionId}`)).text(), "Original");
    assert.equal(api.GET(new Request("http://localhost/api/artifacts")).status, 403);
  } finally {
    if (previousPath === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
