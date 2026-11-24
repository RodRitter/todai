import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import * as api from "../app/api/artifacts/route.ts";
import { GET as download } from "../app/api/artifacts/download/route.ts";

test("HTTP publication, edits, downloads and archival retain workspace boundaries", async () => {
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
    assert.equal("revisionId" in second, false);
    const preview = download(request(`?id=${first.id}&preview=true`));
    assert.equal(preview.headers.get("X-Todai-Preview"), "text");
    assert.equal(await preview.text(), "Updated");
    assert.equal(preview.headers.get("Content-Security-Policy"), "sandbox; default-src 'none'");
    assert.equal(download(request(`?id=${first.id}&preview=true`, {}, other.id)).status, 400);
    assert.equal(await download(request(`?id=${first.id}`)).text(), "Updated");
    assert.deepEqual(await api.GET(request(`?id=${first.id}`)).json(), second);
    assert.deepEqual(await api.GET(request(`?id=${first.id}&history=true`)).json(), second);
    assert.equal(api.GET(request(`?id=${first.id}&history=true`, {}, other.id)).status, 400);
    assert.equal(download(request(`?id=${first.id}&revision=legacy`)).status, 200);
    for (const [filename, mediaType, kind, content] of [
      ["untyped.md", "", "markdown", "# Uploaded notes"],
      ["notes.md", "text/markdown", "markdown", "# Notes\n<script>alert(1)</script>"],
      ["screenshot.png", "image/png", "image", "image bytes"],
      ["document.pdf", "application/pdf", "pdf", "%PDF-1.7"],
      ["page.html", "text/html", "unsupported", "<script>alert(1)</script>"],
      ["vector.svg", "image/svg+xml", "unsupported", "<svg onload='alert(1)'/>"],
      ["document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "unsupported", "office bytes"],
    ]) {
      const form = new FormData();
      Object.entries({ title: filename, type: "file", creator: "Alice" }).forEach(([key, value]) => form.set(key, value));
      form.set("file", new File([content], filename, { type: mediaType }));
      const file = await (await api.POST(request("", { method: "POST", body: form }))).json();
      const query = `?id=${file.id}`;
      const response = download(request(`${query}&preview=true`));
      assert.equal(response.status, kind === "unsupported" ? 415 : 200, filename);
      if (kind !== "unsupported") {
        assert.equal(response.headers.get("X-Todai-Preview"), kind);
        assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
        assert.equal(await response.text(), content);
      }
      assert.equal(await download(request(query)).text(), content);
      assert.match(download(request(query)).headers.get("Content-Disposition")!, /^attachment;/);
      assert.equal(download(request(`${query}&preview=true`, {}, other.id)).status, 400);
    }
    assert.equal(download(request(`?id=${first.id}&revision=legacy&preview=true`)).status, 200);
    assert.equal(download(request("?id=../../etc/passwd&preview=true")).status, 400);
    assert.equal(download(new Request("http://localhost/api/artifacts/download?preview=true")).status, 403);
    const archived = await api.PATCH(request("", { method: "PATCH", body: JSON.stringify({ id: first.id }) }));
    assert.equal(archived.status, 200);
    assert.equal((await api.GET(request()).json()).some((item: { id: string }) => item.id === first.id), false);
    assert.equal((await api.GET(request("?archived=true")).json()).length, 1);
    assert.equal(await download(request(`?id=${first.id}`)).text(), "Updated");
    assert.equal(api.GET(new Request("http://localhost/api/artifacts")).status, 403);
  } finally {
    if (previousPath === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
