import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("workspace chat renders an agent reply and its copy control without an outer tooltip provider", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  });
  try {
    const { WorkspaceChatView } = await server.ssrLoadModule("/src/components/chat/workspace-chat-view.tsx");
    const html = renderToStaticMarkup(createElement(WorkspaceChatView, {
      chats: [], statuses: [],
      session: {
        id: "chat", title: "Test chat", tool: "codex", model: "test-model", effort: "medium",
        createdAt: "2026-11-25T10:00:00Z", updatedAt: "2026-11-25T10:00:00Z",
        running: false, error: null, activities: [],
        messages: [
          { id: "human", authorRole: "human", authorName: "Human", body: "Hello" },
          { id: "reply", authorRole: "agent", authorName: "Assistant", body: "Hello from the assistant", model: "test-model" },
        ],
      },
      onSelect() {}, onCreate() {}, onRetry() {},
      async onRename() {}, async onDelete() {}, async onModelChange() {}, async onSend() {},
    }));
    assert.match(html, /Hello from the assistant/);
    assert.match(html, /aria-label="Copy reply"/);
  } finally {
    await server.close();
  }
});
