import { openTaskStore } from "../../../server/database.ts";
import { WorkspaceChatStore } from "../../../server/workspace-chat-store.ts";
import { sendWorkspaceChat } from "../../../server/workspace-chat-service.ts";
import { createWorkspaceChatRunner } from "../../../server/workspace-chat-runner.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  let tasks, chats;
  try {
    const workspaceId = request.headers.get("X-Todai-Workspace");
    if (!workspaceId) throw new Error("A workspace ID is required.");
    tasks = openTaskStore(workspaceId); chats = new WorkspaceChatStore(tasks);
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("id");
      return Response.json(id ? chats.get(id) : chats.list());
    }
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Send chat settings as an object.");
    if (request.method === "POST" && input.action === "create") return Response.json(chats.create(), { status: 201 });
    if (typeof input.id !== "string" || !input.id) throw new Error("Choose a chat.");
    if (request.method === "PATCH") return Response.json(input.action === "model" ? chats.setModel(input.id, input) : chats.rename(input.id, input.title));
    if (request.method === "DELETE") { chats.delete(input.id); return new Response(null, { status: 204 }); }
    if (input.action !== "send") throw new Error("Choose a chat operation.");
    return Response.json(await sendWorkspaceChat(tasks, chats, input.id, input.body, input, createWorkspaceChatRunner()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The chat request failed." }, { status: 400 });
  } finally { chats?.close(); tasks?.close(); }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
