import { openTaskStore } from "../../../server/database.ts";
import { ChatStore } from "../../../server/chat-store.ts";
import { sendChat } from "../../../server/chat-service.ts";
import { createExecutorRunner } from "../../../server/executor-runner.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, write: boolean) {
  const workspaceId = request.headers.get("X-Todai-Workspace");
  if (!workspaceId) return Response.json({ error: "A workspace ID is required." }, { status: 400 });
  let tasks, chats;
  try {
    tasks = openTaskStore(workspaceId);
    chats = new ChatStore(tasks);
    if (!write) {
      const params = new URL(request.url).searchParams;
      const taskId = params.get("taskId");
      if (!taskId) throw new Error("A task ID is required.");
      if (params.has("id")) throw new Error("Open the task chat without a session ID.");
      return Response.json(chats.forTask(taskId));
    }
    const input = await request.json();
    if (typeof input.taskId !== "string" || !input.taskId) throw new Error("A task ID is required.");
    if (request.method === "DELETE") {
      if (input.clear === true && input.messageId === undefined) return Response.json(chats.clear(input.taskId));
      if (input.clear !== undefined) throw new Error("Choose one message or clear the chat.");
      return Response.json(chats.deleteMessage(input.taskId, input.messageId));
    }
    if (input.id || input.commentId) throw new Error("Send messages to the task chat without a session or comment ID.");
    return Response.json(await sendChat(tasks, chats, input.taskId, input.body, createExecutorRunner()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the chat." }, { status: 400 });
  } finally { chats?.close(); tasks?.close(); }
}
export function GET(request: Request) { return handle(request, false); }
export function POST(request: Request) { return handle(request, true); }
export function DELETE(request: Request) { return handle(request, true); }
