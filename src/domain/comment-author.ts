import type { TaskComment } from "./task.ts";

export function isHumanComment(comment: Pick<TaskComment, "authorRole" | "authorName">) {
  return comment.authorRole ? comment.authorRole === "human" : comment.authorName === "Human";
}
