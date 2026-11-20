import type { TaskComment } from "./task";
import type { AgentProfile } from "./column-agent";
import { agentMentionPath } from "./agent-mentions.ts";

function label(value: string) { return value.replace(/[\\[\]]/g, "\\$&"); }

export function commentReference(comment: TaskComment) {
  return `[Comment by ${label(comment.authorName || "Agent") }](#comment/${encodeURIComponent(comment.taskId)}/${encodeURIComponent(comment.id)})`;
}

export function parseCommentReference(path: string) {
  const match = /^#comment\/([^/]+)\/([^/]+)$/.exec(path);
  if (!match) return null;
  try { return { taskId: decodeURIComponent(match[1]), commentId: decodeURIComponent(match[2]) }; }
  catch { return null; }
}

export function referencedCommentIds(body: string, taskId: string) {
  const text = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "");
  return [...new Set([...text.matchAll(/\]\((#comment\/[^)]+)\)/g)].flatMap((match) => {
    const reference = parseCommentReference(match[1]);
    return reference?.taskId === taskId ? [reference.commentId] : [];
  }))];
}

export function commentChatDraft(comment: TaskComment, agents: Pick<AgentProfile, "id" | "name">[]) {
  const authors = agents.filter((agent) => agent.name === comment.authorName);
  const tag = authors.length === 1 ? `[@${label(authors[0].name)}](${agentMentionPath(authors[0].id)}) ` : "";
  return `${tag}${commentReference(comment)} `;
}
