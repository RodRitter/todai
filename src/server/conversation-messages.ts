import { isHumanComment } from "../domain/comment-author.ts";
import type { DatabaseSync } from "node:sqlite";
import type { TaskComment } from "../domain/task.ts";

type MessageScope = { workspaceId: string; taskId: string } & (
  { kind: "comments" } | { kind: "chat"; sessionId: string }
);

export function conversationDeletion(messages: TaskComment[], messageId?: string) {
  if (messageId === undefined) return messages;
  const ids = new Set([messageId]);
  let changed = true;
  while (changed) {
    changed = false;
    const feedbackRuns = new Set(messages.filter((message) => ids.has(message.id) && message.feedbackStatus && message.runId).map((message) => message.runId));
    for (const message of messages) {
      if (ids.has(message.id)) continue;
      if ((message.parentCommentId && ids.has(message.parentCommentId)) ||
          (!message.parentCommentId && isHumanComment(message) && !message.feedbackStatus && message.runId && feedbackRuns.has(message.runId))) {
        ids.add(message.id);
        changed = true;
      }
    }
  }
  return messages.filter((message) => ids.has(message.id));
}

// Call inside the owner's transaction, after its execution and ownership checks.
// Both stores use this deletion and artifact cleanup implementation.
export function removeConversationMessages(db: DatabaseSync, scope: MessageScope, messages: TaskComment[], messageId?: string) {
  const deleting = conversationDeletion(messages, messageId);
  if (scope.kind === "chat") {
    const remove = db.prepare(`DELETE FROM chat_messages WHERE id = ? AND sessionId = ?
      AND EXISTS (SELECT 1 FROM chat_sessions WHERE id = ? AND workspaceId = ? AND taskId = ?)`);
    for (const message of deleting) remove.run(message.id, scope.sessionId, scope.sessionId, scope.workspaceId, scope.taskId);
  } else {
    const remove = db.prepare("DELETE FROM comments WHERE workspaceId = ? AND taskId = ? AND id = ?");
    for (const message of deleting) remove.run(scope.workspaceId, scope.taskId, message.id);
  }
  const artifactIds = new Set(deleting.flatMap((message) => (message.artifacts ?? []).map((ref) => ref.artifactId)));
  const unlinked = db.prepare(`SELECT id FROM artifacts WHERE workspaceId = ? AND id = ?
    AND NOT EXISTS (SELECT 1 FROM comment_artifacts WHERE artifactId = artifacts.id)
    AND NOT EXISTS (SELECT 1 FROM task_artifacts WHERE artifactId = artifacts.id)`);
  const removeArtifact = db.prepare("DELETE FROM artifacts WHERE workspaceId = ? AND id = ?");
  for (const id of artifactIds) {
    if (!unlinked.get(scope.workspaceId, id)) continue;
    removeArtifact.run(scope.workspaceId, id);
  }
  return deleting;
}
