import { intentProfile } from "./comment-intent.ts";
import { randomUUID } from "node:crypto";
import type { TaskStore } from "./task-store.ts";
import { WorkspaceChatStore } from "./workspace-chat-store.ts";
import { openWorkspaceChatTools } from "./workspace-chat-tools.ts";
import type { WorkspaceChatRunner } from "./workspace-chat-runner.ts";

export async function sendWorkspaceChat(tasks: TaskStore, chats: WorkspaceChatStore, id: string, body: unknown, model: unknown, runner: WorkspaceChatRunner, titleRunner?: WorkspaceChatRunner) {
  const { session, lease, turnId, generateTitle } = chats.begin(id, body, model);
  const signal = AbortSignal.timeout(300000), usageId = randomUUID(), usage = tasks.usage();
  let server: Awaited<ReturnType<typeof openWorkspaceChatTools>> | undefined;
  let tracking = false;
  try {
    usage.beginWorkspaceChat(usageId, session.model, session.effort); tracking = true;
    server = await openWorkspaceChatTools(tasks, signal, () => chats.assertLease(id, lease), turnId, activity => chats.activity(id, lease, activity));
    if (generateTitle && titleRunner) {
      const titleUsageId = randomUUID(), profile = intentProfile(session.tool);
      const titleSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
      usage.beginWorkspaceChat(titleUsageId, profile.model, profile.effort);
      try {
        const output = await titleRunner({
          kind: "workspace-chat-title", session: { ...session, model: profile.model, effort: profile.effort },
          connection: server.connection, signal: titleSignal, onUsage: tokens => usage.record(titleUsageId, tokens),
        });
        titleSignal.throwIfAborted();
        const title = output.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ").replace(/\.$/, "");
        if (!title || title.length > 80) throw new Error("The generated title is invalid.");
        chats.setGeneratedTitle(id, lease, session.title, title);
        usage.finish(titleUsageId, "Complete");
      } catch {
        usage.finish(titleUsageId, titleSignal.aborted ? "Interrupted" : "Failed");
        // A title failure must not prevent the requested response.
      }
    }
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
