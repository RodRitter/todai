import type { DatabaseSync } from "node:sqlite";
import type { TaskComment } from "../domain/task.ts";
import { groupActivity } from "../domain/activity.ts";

type MessageScope = { workspaceId: string; taskId: string } & (
  { kind: "comments" } | { kind: "chat"; sessionId: string }
);

export function conversationDeletion(messages: TaskComment[], messageId?: string) {
  if (messageId === undefined) return messages;
  const selected = messages.filter((message) => message.id === messageId);
  const replies = groupActivity(messages).find(({ message }) => message.id === messageId)?.replies ?? [];
  return [...selected, ...replies];
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
  const removeRevisions = db.prepare("DELETE FROM artifact_revisions WHERE workspaceId = ? AND id = ?");
  const removeArtifact = db.prepare("DELETE FROM artifacts WHERE workspaceId = ? AND id = ?");
  for (const id of artifactIds) {
    if (!unlinked.get(scope.workspaceId, id)) continue;
    removeRevisions.run(scope.workspaceId, id);
    removeArtifact.run(scope.workspaceId, id);
  }
  return deleting;
}
