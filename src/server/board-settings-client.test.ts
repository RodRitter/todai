import assert from "node:assert/strict";
import test from "node:test";
import { boardSettingsApi, taskApi } from "../lib/workspace-api.ts";

test("local settings editors retain their own board scope without changing the task board", async (context) => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: {} } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "http://localhost/settings?workspace=workspace&board=original" } } });
  const requests: { board: string | null; workspace: string | null; method?: string; body?: BodyInit | null }[] = [];
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const headers = new Headers(options.headers);
    requests.push({ board: headers.get("X-Todai-Board"), workspace: headers.get("X-Todai-Workspace"), method: options.method, body: options.body });
    return Response.json([]);
  });
  try {
    const research = boardSettingsApi("research");
    const product = boardSettingsApi("product");
    await research.load();
    await product.load();
    await research.rename("Ideas", "Backlog");
    await product.create("Review");
    await research.reorder(["Backlog", "Done"]);
    await product.remove("Review");
    await taskApi.list();
    assert.deepEqual(requests.map((request) => request.board), ["research", "product", "research", "product", "research", "product", "original"]);
    assert.ok(requests.every((request) => request.workspace === "workspace"));
    assert.equal(requests[2].method, "PATCH");
    assert.deepEqual(JSON.parse(requests[2].body as string), { column: "Ideas", name: "Backlog" });
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
