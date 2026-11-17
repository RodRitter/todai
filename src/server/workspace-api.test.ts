import assert from "node:assert/strict";
import test from "node:test";
import {
  agentApi,
  columnApi,
  taskApi,
  workspaceApi,
} from "../lib/workspace-api.ts";

test("client mutations serialize JSON and return the saved server value", async (context) => {
  const fetch = context.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/columns");
      assert.equal(options.method, "PATCH");
      assert.equal(options.cache, "no-store");
      assert.equal(
        new Headers(options.headers).get("Content-Type"),
        "application/json",
      );
      assert.deepEqual(JSON.parse(options.body as string), {
        column: "To do",
        name: "Planned",
      });
      return Response.json(["Planned", "Done"]);
    },
  );
  assert.deepEqual(await columnApi.rename("To do", "Planned"), [
    "Planned",
    "Done",
  ]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("deletion encodes IDs and accepts an empty response", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/agents?id=agent%2Fone%3F");
      assert.equal(options.method, "DELETE");
      assert.equal(options.body, undefined);
      return new Response(null, { status: 204 });
    },
  );
  assert.equal(await agentApi.delete("agent/one?"), undefined);
});

test("failed requests preserve server errors and use a fallback when absent", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Database unavailable." }, { status: 500 }),
  );
  await assert.rejects(taskApi.list(), /Database unavailable\./);
  fetch.mock.mockImplementation(async () => Response.json({}, { status: 500 }));
  await assert.rejects(
    workspaceApi.get(),
    /Could not load workspace settings\./,
  );
});

test("directory suggestions preserve the request cancellation signal", async (context) => {
  const controller = new AbortController();
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/directories?path=~%2FMy%20Projects%2F");
      assert.equal(options.signal, controller.signal);
      return Response.json(["/home/me/My Projects/todai"]);
    },
  );
  assert.deepEqual(
    await workspaceApi.directories("~/My Projects/", controller.signal),
    ["/home/me/My Projects/todai"],
  );
});

test("requests retain their document workspace even after URL changes and late responses", async (context) => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const location = { href: "http://localhost/?workspace=second" };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: { workspaceId: "first" } } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  let release!: (response: Response) => void;
  const owners: (string | null)[] = [];
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    owners.push(new Headers(options.headers).get("X-Todai-Workspace"));
    if (owners.length === 1) return new Promise<Response>((resolve) => { release = resolve; });
    return Response.json({ path: "/second" });
  });
  try {
    const pending = workspaceApi.get();
    location.href = "http://localhost/settings?workspace=third";
    await workspaceApi.save("/second");
    release(Response.json({ path: "/second" }));
    assert.deepEqual(await pending, { path: "/second" });
    assert.deepEqual(owners, ["second", "second"]);
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else Reflect.deleteProperty(globalThis, "document");
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
