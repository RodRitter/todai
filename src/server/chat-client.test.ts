import assert from "node:assert/strict";
import test from "node:test";
import { chatRequest } from "../components/chat/chat-client.ts";

test("chat messages recover from an empty response without showing a JSON parser error", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => ++calls === 1 ? new Response("") : Response.json([]));
  assert.deepEqual(await chatRequest("?taskId=task"), []);
  assert.equal(calls, 2);
});

test("truncated reads retry once and report a clear error if recovery fails", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return new Response("["); });
  await assert.rejects(chatRequest("?taskId=task"), /Could not load chat messages/);
  assert.equal(calls, 2);
});

test("an empty write response never repeats a message", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return new Response(""); });
  await assert.rejects(chatRequest("", { taskId: "task", body: "Question" }), /Check this task's Chat tab before trying again/);
  assert.equal(calls, 1);
  await assert.rejects(chatRequest("", { taskId: "task", body: "Another question" }), /Check this task's Chat tab before trying again/);
  assert.equal(calls, 2);
});

test("server validation errors remain visible without a retry", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ error: "A workspace ID is required." }, { status: 400 }); });
  await assert.rejects(chatRequest(), /A workspace ID is required/);
  assert.equal(calls, 1);
});

test("aborting an incomplete response prevents retry", async (context) => {
  const controller = new AbortController();
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    controller.abort();
    return new Response("");
  });
  await assert.rejects(chatRequest("?taskId=task", undefined, controller.signal), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("non-JSON error responses and null bodies never expose parser failures", async (context) => {
  for (const body of ["<html>Service unavailable</html>", "null"]) {
    context.mock.method(globalThis, "fetch", async () => new Response(body, { status: 503 }));
    await assert.rejects(chatRequest(), /Could not load chat messages/);
    context.mock.restoreAll();
  }
});

test("delete requests use DELETE and never retry an uncertain mutation", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (_input: unknown, options: RequestInit) => {
    calls++;
    assert.equal(options.method, "DELETE");
    assert.deepEqual(JSON.parse(String(options.body)), { taskId: "task", clear: true });
    return new Response("");
  });
  await assert.rejects(chatRequest("", { taskId: "task", clear: true }, undefined, "DELETE"), /Check this task's Chat tab/);
  assert.equal(calls, 1);
});
