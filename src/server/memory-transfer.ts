import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { referenceIds, selectMemory, type MemoryTransfer } from "../domain/memory-transfer.ts";
import { normalizeTaskReferences } from "../domain/task-reference.ts";
import { searchMemoryEntries, memoryDocument } from "./memory-entries.ts";

// The caller owns the transaction for configuration and memory together.
export function exportMemory(db: DatabaseSync, workspaceId: string): MemoryTransfer | undefined {
  const entries: MemoryTransfer["entries"] = [];
  for (let offset = 0; ; offset += 50) {
    const page = searchMemoryEntries(db, workspaceId, "", offset, 50);
    entries.push(...page.entries);
    if (!page.hasMore) break;
  }
  if (!entries.length) return undefined;
  const linkedTasks = new Set(referenceIds(entries.map((entry) => [entry.source, entry.statement, entry.details ?? ""].join("\n")).join("\n"), "task"));
  const tasks = db.prepare("SELECT id, title, description, status FROM tasks WHERE workspaceId = ?").all(workspaceId).filter((task) => linkedTasks.has(String(task.id))).map((task) => ({
    ...task,
    comments: db.prepare("SELECT id, body, createdAt, authorName, authorRole, recommendation, parentCommentId FROM comments WHERE workspaceId = ? AND taskId = ? ORDER BY createdAt, id").all(workspaceId, task.id).map((comment) => ({
      ...comment, artifactIds: db.prepare("SELECT ca.artifactId FROM comment_artifacts ca JOIN artifacts a ON a.id = ca.artifactId WHERE ca.commentId = ? AND a.workspaceId = ?").all(comment.id, workspaceId).map((row) => String(row.artifactId)),
    })),
    artifactIds: db.prepare("SELECT ta.artifactId FROM task_artifacts ta JOIN artifacts a ON a.id = ta.artifactId WHERE ta.taskId = ? AND a.workspaceId = ?").all(task.id, workspaceId).map((row) => String(row.artifactId)),
  })) as MemoryTransfer["tasks"];
  const artifacts = db.prepare("SELECT id, title, description, type, creator, createdAt, updatedAt, filename, mediaType, url, taskId FROM artifacts WHERE workspaceId = ?").all(workspaceId).map((row) => ({ ...row, content: null })) as MemoryTransfer["artifacts"];
  const selected = selectMemory({ entries, tasks, artifacts }, entries.map((entry) => entry.id));
  for (const artifact of selected.artifacts) {
    const content = db.prepare("SELECT content FROM artifacts WHERE workspaceId = ? AND id = ?").get(workspaceId, artifact.id)!.content;
    artifact.content = content === null ? null : Buffer.from(content as Uint8Array).toString("base64");
  }
  return selected;
}

export function importMemory(db: DatabaseSync, workspaceId: string, boardId: string, input: MemoryTransfer) {
  // Evidence is always copied. Overwriting configuration must not change live source records.
  const data = selectMemory(input, input.entries.map((entry) => entry.id));
  const taskIds = new Map(data.tasks.map((task) => [task.id, randomUUID()]));
  const artifactIds = new Map(data.artifacts.map((artifact) => [artifact.id, randomUUID()]));
  const entryIds = new Map(data.entries.map((entry) => [entry.id, randomUUID()]));
  const commentIds = new Map(data.tasks.flatMap((task) => task.comments.map((comment) => [comment.id, randomUUID()] as const)));
  const rewrite = (text: string) => normalizeTaskReferences(text).replace(/#(task|artifact|comment)\/([^\s)/]+)(?:\/([^\s)]+))?/g, (original, kind: string, encoded: string, child?: string) => {
    let id: string;
    try { id = decodeURIComponent(encoded); } catch { return original; }
    const mapped = (kind === "artifact" ? artifactIds : taskIds).get(id);
    if (!mapped) return original;
    if (kind === "comment") return child && commentIds.has(child) ? `#comment/${mapped}/${commentIds.get(child)}` : original;
    return `#${kind}/${mapped}`;
  });
  const now = new Date().toISOString();
  for (const task of data.tasks) {
    db.prepare("INSERT INTO tasks (id, workspaceId, boardId, title, description, status, agentStatus, archivedAt, autoWorkflow, autoRun) VALUES (?, ?, ?, ?, ?, ?, 'Not started', ?, 0, 0)")
      .run(taskIds.get(task.id)!, workspaceId, boardId, task.title, rewrite(task.description), task.status, now);
    for (const comment of task.comments) {
      db.prepare("INSERT INTO comments (id, workspaceId, taskId, body, createdAt, authorName, authorRole, recommendation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(commentIds.get(comment.id)!, workspaceId, taskIds.get(task.id)!, rewrite(comment.body), comment.createdAt, comment.authorName, comment.authorRole, comment.recommendation === null ? null : rewrite(comment.recommendation));
    }
    for (const comment of task.comments) if (comment.parentCommentId && task.comments.some((parent) => parent.id === comment.parentCommentId))
      db.prepare("UPDATE comments SET parentCommentId = ? WHERE id = ?").run(commentIds.get(comment.parentCommentId)!, commentIds.get(comment.id)!);
  }
  for (const artifact of data.artifacts) {
    let bytes = artifact.content === null ? null : Buffer.from(artifact.content, "base64");
    if (bytes && ["text", "markdown"].includes(artifact.type)) bytes = Buffer.from(rewrite(bytes.toString("utf8")));
    db.prepare(`INSERT INTO artifacts (id, workspaceId, title, description, type, creator, createdAt, updatedAt, filename, mediaType, url, content, byteSize, archived, taskId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(artifactIds.get(artifact.id)!, workspaceId, artifact.title, rewrite(artifact.description), artifact.type,
      artifact.creator, artifact.createdAt, artifact.updatedAt, artifact.filename, artifact.mediaType, artifact.url, bytes, bytes?.length ?? null, artifact.taskId ? taskIds.get(artifact.taskId) ?? null : null);
  }
  for (const task of data.tasks) {
    for (const id of task.artifactIds) db.prepare("INSERT INTO task_artifacts VALUES (?, ?)").run(taskIds.get(task.id)!, artifactIds.get(id)!);
    for (const comment of task.comments) for (const id of comment.artifactIds)
      db.prepare("INSERT INTO comment_artifacts VALUES (?, ?)").run(commentIds.get(comment.id)!, artifactIds.get(id)!);
  }
  for (const entry of data.entries) {
    const imported = { ...entry, id: entryIds.get(entry.id)!, source: rewrite(entry.source), statement: rewrite(entry.statement), details: rewrite(entry.details ?? ""), supersedes: entryIds.get(entry.supersedes ?? "") ?? "" };
    db.prepare(`INSERT INTO memory_entries (id, workspaceId, revision, category, title, statement, scope, source, updatedAt, removed, details, needsReview, supersedes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(imported.id, workspaceId, imported.revision, imported.category, imported.title, imported.statement,
      imported.scope, imported.source, imported.updatedAt, Number(imported.retired ?? false), imported.details, Number(imported.needsReview ?? false), imported.supersedes);
    db.prepare("INSERT INTO memory_versions VALUES (?, ?, ?, ?, ?)").run(workspaceId, imported.id, imported.revision, JSON.stringify(imported), "Imported memory.");
  }
  db.prepare("INSERT OR IGNORE INTO memory_entry_migrations VALUES (?)").run(workspaceId);
  db.prepare("INSERT INTO workspace_memory (workspaceId, revision, document, sourceTaskId, createdAt) VALUES (?, (SELECT COALESCE(MAX(revision), 0) + 1 FROM workspace_memory WHERE workspaceId = ?), ?, '', ?)")
    .run(workspaceId, workspaceId, memoryDocument(db, workspaceId), now);
  return data.entries.length;
}
