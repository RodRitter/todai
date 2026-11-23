import { isHumanComment } from "./comment-author.ts";
import type { TaskComment } from "./task.ts";

// Feedback answers share the requesting run's ID; ordinary messages do not.
export function groupActivity(comments: TaskComment[]) {
  const questions = new Map(comments.filter((comment) => comment.feedbackStatus && comment.runId).map((comment) => [comment.runId!, comment.id]));
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const parents = new Map(comments.map((comment) => {
    const questionId = isHumanComment(comment) && !comment.feedbackStatus && comment.runId ? questions.get(comment.runId) : undefined;
    return [comment.id, comment.parentCommentId && byId.has(comment.parentCommentId) ? comment.parentCommentId : questionId];
  }));
  const replies = new Map<string, TaskComment[]>();
  const messages: TaskComment[] = [];
  for (const comment of comments) {
    let root = comment.id;
    const visited = new Set([root]);
    while (parents.get(root) && byId.has(parents.get(root)!)) {
      const parent = parents.get(root)!;
      if (visited.has(parent)) { root = comment.id; break; }
      visited.add(parent);
      root = parent;
    }
    if (root !== comment.id) replies.set(root, [...(replies.get(root) ?? []), comment]);
    else messages.push(comment);
  }
  return messages.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((message) => ({
    message,
    replies: (replies.get(message.id) ?? []).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
  }));
}
