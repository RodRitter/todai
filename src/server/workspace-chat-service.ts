import { randomUUID } from "node:crypto";
import type { TaskStore } from "./task-store.ts";
import { WorkspaceChatStore } from "./workspace-chat-store.ts";
import { openWorkspaceChatTools } from "./workspace-chat-tools.ts";
import type { WorkspaceChatRunner } from "./workspace-chat-runner.ts";

export async function sendWorkspaceChat(tasks: TaskStore, chats: WorkspaceChatStore, id: string, body: unknown, model: unknown, runner: WorkspaceChatRunner) {
  const { session, lease, turnId } = chats.begin(id, body, model);
  const signal = AbortSignal.timeout(300000), usageId = randomUUID(), usage = tasks.usage();
  let server: Awaited<ReturnType<typeof openWorkspaceChatTools>> | undefined;
  let tracking = false;
  try {
    usage.beginWorkspaceChat(usageId, session.model, session.effort); tracking = true;
    server = await openWorkspaceChatTools(tasks, signal, () => chats.assertLease(id, lease), turnId, activity => chats.activity(id, lease, activity));
    const answer = await runner({ kind: "workspace-chat", session, connection: server.connection, signal, onUsage: tokens => usage.record(usageId, tokens) });
    signal.throwIfAborted();
    if (!answer.trim()) throw new Error("The model returned an empty response.");
    chats.finish(id, lease, answer);
    usage.finish(usageId, "Complete");
  } catch (error) {
    if (tracking) usage.finish(usageId, signal.aborted ? "Interrupted" : "Failed");
    chats.finish(id, lease, undefined, error instanceof Error ? error.message : "The response failed. Send a message to continue.");
  } finally { server?.close(); }
  return chats.get(id);
}
