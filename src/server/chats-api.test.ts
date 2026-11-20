import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { GET, POST, DELETE } from "../app/api/chats/route.ts";

test("chat HTTP requests require task scope and reject sessions from another task", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-chats-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const request = (query = "", input?: unknown, method = "POST") => new Request(`http://localhost/api/chats${query}`, {
    method: input === undefined ? "GET" : method,
    headers: { "Content-Type": "application/json", "X-Todai-Workspace": store.workspaceId },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  try {
    store.saveAgent({ id: "author", name: "Author", tool: "codex", model: "test", effort: "medium", permissions: "read-only", instructions: "Explain." });
    store.save({ id: "task", title: "Task", description: "Details", status: "To do" });
    store.addComment({ id: "comment", taskId: "task", authorName: "Author", body: "Context", createdAt: new Date().toISOString() });
    assert.equal((await GET(request())).status, 400);
    assert.equal((await GET(request("?taskId=missing"))).status, 400);
    const detail = await GET(request("?taskId=task"));
    assert.equal(detail.status, 200);
    const session = await detail.json();
    assert.deepEqual(session.messages, []);
    assert.equal((await (await GET(request("?taskId=task"))).json()).id, session.id);
    assert.equal((await POST(request("", { taskId: "other", body: "Do not send" }))).status, 400);
    assert.equal((await POST(request("", { taskId: "task", commentId: "comment" }))).status, 400);
    assert.equal((await POST(request("", { taskId: "task", id: session.id, body: "Old request" }))).status, 400);
    assert.equal((await POST(request("", { taskId: "task", body: " " }))).status, 400);
    const sent = await POST(request("", { taskId: "task", body: "A note for later." }));
    assert.equal(sent.status, 200);
    const messages = (await sent.json()).messages;
    assert.equal(messages.length, 1);
    assert.equal((await DELETE(request("", { taskId: "task" }, "DELETE"))).status, 400);
    assert.equal((await DELETE(request("", { taskId: "other", messageId: messages[0].id }, "DELETE"))).status, 400);
    const deleted = await DELETE(request("", { taskId: "task", messageId: messages[0].id }, "DELETE"));
    assert.equal(deleted.status, 200);
    assert.deepEqual((await deleted.json()).messages, []);
    await POST(request("", { taskId: "task", body: "Another note." }));
    assert.equal((await DELETE(request("", { taskId: "task", clear: true, messageId: "ambiguous" }, "DELETE"))).status, 400);
    const cleared = await DELETE(request("", { taskId: "task", clear: true }, "DELETE"));
    assert.equal(cleared.status, 200);
    assert.deepEqual((await cleared.json()).messages, []);
    assert.equal(store.list()[0].comments?.length, 1);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH;
    else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
