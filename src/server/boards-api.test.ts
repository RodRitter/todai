import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { GET, POST, PATCH, DELETE, PUT } from "../app/api/boards/route.ts";

test("board HTTP lifecycle validates names and ownership, and lists boards even with a stale selection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-boards-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const request = (method: string, body?: unknown, boardId = store.boardId) => new Request("http://localhost/api/boards", {
    method, headers: { "Content-Type": "application/json", "X-Todai-Workspace": store.workspaceId, "X-Todai-Board": boardId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    for (const input of [null, {}, { name: " " }, { name: 12 }, { name: "x".repeat(81) }])
      assert.equal((await POST(request("POST", input))).status, 400);
    const created = await POST(request("POST", { name: " Product ", description: " Plan product work. " }));
    assert.equal(created.status, 200);
    const board = await created.json();
    assert.equal(board.name, "Product");
    assert.equal(board.description, "Plan product work.");
    for (const description of [null, 12, " ", "x".repeat(501)])
      assert.equal((await POST(request("POST", { name: "Invalid", description }))).status, 400);
    assert.equal((await POST(request("POST", { name: "product" }))).status, 400);
    assert.equal((await PATCH(request("PATCH", { id: board.id, name: "Research" }, board.id))).status, 200);
    assert.equal(store.listBoards()[1].name, "Research");
    assert.equal(store.listBoards()[1].description, "Plan product work.");
    assert.equal((await PATCH(request("PATCH", { id: board.id, name: "Research", description: "Investigate product ideas." }))).status, 200);
    assert.equal(store.listBoards()[1].description, "Investigate product ideas.");
    assert.equal((await PUT(request("PUT", [board.id, store.boardId], "stale"))).status, 200);
    assert.equal((await GET(request("GET")).json())[0].id, board.id);
    assert.equal((await PUT(request("PUT", [board.id, board.id]))).status, 400);
    const other = store.createWorkspace("Other", directory);
    assert.equal((await PATCH(request("PATCH", { id: other.id, name: "Wrong" }))).status, 400);
    assert.equal((await DELETE(request("DELETE", { id: other.id }))).status, 400);
    assert.equal((await DELETE(request("DELETE", { id: board.id }, board.id))).status, 204);
    assert.equal((await GET(request("GET", undefined, board.id)).json()).length, 1);
    const recreated = await POST(request("POST", { name: "Replacement" }, board.id));
    assert.equal(recreated.status, 200);
    assert.equal((await recreated.json()).name, "Replacement");
    assert.equal(GET(new Request("http://localhost/api/boards")).status, 400);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
