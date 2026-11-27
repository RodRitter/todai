import { memoryCategories, type MemoryEntry } from "./memory.ts";
import { normalizeTaskReferences } from "./task-reference.ts";

export type MemoryTransfer = {
  entries: MemoryEntry[];
  tasks: { id: string; title: string; description: string; status: string; comments: { id: string; body: string; createdAt: string; authorName: string | null; authorRole: string | null; recommendation: string | null; parentCommentId: string | null; artifactIds: string[] }[]; artifactIds: string[] }[];
  artifacts: { id: string; title: string; description: string; type: string; creator: string; createdAt: string; updatedAt: string; filename: string | null; mediaType: string | null; url: string | null; content: string | null; taskId: string | null }[];
};

export function referenceIds(text: string, kind: "task" | "artifact"): string[] {
  return [...normalizeTaskReferences(text).matchAll(new RegExp(`#${kind === "task" ? "(?:task|comment)" : kind}/([^\\s)/]+)`, "g"))].flatMap((match) => {
    try { return [decodeURIComponent(match[1])]; } catch { return []; }
  });
}

export function selectMemory(data: MemoryTransfer, ids: string[]): MemoryTransfer {
  const entries = data.entries.filter((entry) => ids.includes(entry.id));
  const text = entries.map((entry) => [entry.source, entry.statement, entry.details ?? ""].join("\n")).join("\n");
  const taskIds = new Set(referenceIds(text, "task"));
  const tasks = data.tasks.filter((task) => taskIds.has(task.id));
  const artifactIds = new Set(referenceIds(text, "artifact"));
  for (const task of tasks) {
    for (const id of [...task.artifactIds, ...referenceIds(task.description, "artifact")]) artifactIds.add(id);
    for (const comment of task.comments) for (const id of [...comment.artifactIds, ...referenceIds(comment.body, "artifact")]) artifactIds.add(id);
  }
  return { entries, tasks, artifacts: data.artifacts.filter((artifact) => artifactIds.has(artifact.id) || (artifact.taskId && taskIds.has(artifact.taskId))) };
}

export function parseMemoryTransfer(input: unknown): MemoryTransfer {
  const fail = (): never => { throw new Error("Invalid memory export."); };
  if (!input || typeof input !== "object") return fail();
  const data = input as MemoryTransfer;
  const strings = (value: object, keys: string[]) => keys.every((key) => typeof (value as Record<string, unknown>)[key] === "string");
  const nullable = (value: object, keys: string[]) => keys.every((key) => (value as Record<string, unknown>)[key] === null || typeof (value as Record<string, unknown>)[key] === "string");
  const ids = (values: unknown): values is string[] => Array.isArray(values) && values.every((value) => typeof value === "string");
  for (const list of [data.entries, data.tasks, data.artifacts]) {
    if (!Array.isArray(list) || list.some((item) => !item || typeof item !== "object" || typeof item.id !== "string" || !item.id) || new Set(list.map((item) => item.id)).size !== list.length) return fail();
  }
  for (const entry of data.entries) {
    if (!strings(entry, ["title", "statement", "scope", "source", "updatedAt"]) || !memoryCategories.includes(entry.category) || !Number.isSafeInteger(entry.revision) || entry.revision < 1) return fail();
    for (const key of ["details", "supersedes"] as const) if (entry[key] !== undefined && typeof entry[key] !== "string") return fail();
    for (const key of ["retired", "needsReview", "stale"] as const) if (entry[key] !== undefined && typeof entry[key] !== "boolean") return fail();
  }
  const commentIds = new Set<string>();
  for (const task of data.tasks) {
    if (!strings(task, ["title", "description", "status"]) || !ids(task.artifactIds) || !Array.isArray(task.comments)) return fail();
    for (const comment of task.comments) {
      if (!comment || !strings(comment, ["id", "body", "createdAt"]) || !nullable(comment, ["authorName", "authorRole", "recommendation", "parentCommentId"]) || !ids(comment.artifactIds) || commentIds.has(comment.id)) return fail();
      commentIds.add(comment.id);
    }
  }
  for (const artifact of data.artifacts) {
    if (!strings(artifact, ["title", "description", "type", "creator", "createdAt", "updatedAt"]) || !nullable(artifact, ["filename", "mediaType", "url", "content", "taskId"]) || !["text", "markdown", "file", "link"].includes(artifact.type)) return fail();
    if (artifact.type === "link") {
      try { if (!artifact.url || !["http:", "https:"].includes(new URL(artifact.url).protocol)) return fail(); } catch { return fail(); }
    } else if (artifact.content === null || artifact.content.length > 27962028 || (artifact.content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(artifact.content))) return fail();
  }
  const artifactIds = new Set(data.artifacts.map((artifact) => artifact.id));
  for (const task of data.tasks) if ([...task.artifactIds, ...task.comments.flatMap((comment) => comment.artifactIds)].some((id) => !artifactIds.has(id))) return fail();
  return data;
}
