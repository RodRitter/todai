import type { TaskComment } from "./task.ts";

export function isHumanComment(comment: TaskComment) {
  return comment.authorRole ? comment.authorRole === "human" : comment.authorName === "Human";
}
