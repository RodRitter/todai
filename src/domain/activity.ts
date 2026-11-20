import type { TaskComment } from "./task.ts";

// Feedback answers share the requesting run's ID; ordinary messages do not.
export function groupActivity(comments: TaskComment[]) {
  const questions = new Map(comments.filter((comment) => comment.feedbackStatus && comment.runId).map((comment) => [comment.runId!, comment.id]));
  const replies = new Map<string, TaskComment[]>();
  const messages: TaskComment[] = [];
  for (const comment of comments) {
    const questionId = comment.authorName === "Human" && !comment.feedbackStatus && comment.runId ? questions.get(comment.runId) : undefined;
    if (questionId) replies.set(questionId, [...(replies.get(questionId) ?? []), comment]);
    else messages.push(comment);
  }
  return messages.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((message) => ({
    message,
    replies: (replies.get(message.id) ?? []).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
  }));
}
