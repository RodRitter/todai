import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, RootContent } from "mdast";
import type { CleanupConfirmation, CleanupKind, CleanupPreview, CleanupRecord } from "../domain/workspace-cleanup.ts";
import { parseTaskReference } from "../domain/task-reference.ts";
import { parseCommentReference } from "../domain/comment-reference.ts";
import { parseArtifactMention } from "../domain/artifact-mentions.ts";

export class CleanupValidationError extends Error {}
type Row = Record<string, unknown>;
type Node = { record: CleanupRecord; eligible: boolean; archived: boolean; workspaceId: unknown; links: Set<string> };
const markdown = unified().use(remarkParse);
const key = (kind: CleanupKind, id: unknown) => `${kind}:${id}`;
const tables = ["tasks", "artifacts", "memory_entries", "comments", "runs", "run_activity", "chat_sessions", "chat_messages",
  "task_artifacts", "comment_artifacts", "memory_versions", "memory_reviews", "workspace_memory", "workspace_chats",
  "workspace_chat_messages", "workspace_chat_activity", "agents", "settings", "board_columns", "column_assignments", "boards", "workspaces"] as const;

export function previewCleanup(db: DatabaseSync, workspaceId: string, retentionDays: number, asOf = new Date().toISOString()): CleanupPreview {
  if (![0, 30, 90, 180].includes(retentionDays)) throw new CleanupValidationError("Choose immediate cleanup, or 30, 90, or 180 days.");
  const time = Date.parse(asOf);
  if (!Number.isFinite(time) || time > Date.now() + 1000 || Date.now() - time > 15 * 60_000)
    throw new CleanupValidationError("The preview expired. Preview cleanup again.");
  const cutoff = time - retentionDays * 86400000;
  const rows = Object.fromEntries(tables.map(table => {
    // Keep binary payloads out of the graph snapshot. Read one artifact at a time below.
    const fields = table === "artifacts"
      ? db.prepare("PRAGMA table_info(artifacts)").all().map(column => String(column.name)).filter(name => name !== "content").join(", ")
      : "*";
    return [table, db.prepare(`SELECT ${fields} FROM ${table} ORDER BY rowid`).all()];
  })) as Record<typeof tables[number], Row[]>;
  if (!rows.workspaces.some(row => row.id === workspaceId && !row.archived)) throw new CleanupValidationError("Choose an active workspace.");
  const nodes = new Map<string, Node>();
  for (const [table, kind, flag, date] of [["tasks", "task", "archivedAt", "archivedAt"], ["artifacts", "artifact", "archived", "archivedAt"], ["memory_entries", "memory", "removed", "retiredAt"]] as const) {
    for (const row of rows[table]) {
      const old = retentionDays === 0 || Number.isFinite(Date.parse(String(row[date]))) && Date.parse(String(row[date])) < cutoff;
      const worktree = kind === "task" && Boolean(row.worktree);
      const eligible = row.workspaceId === workspaceId && Boolean(row[flag]) && old && !worktree;
      nodes.set(key(kind, row.id), { eligible, archived: Boolean(row[flag]), workspaceId: row.workspaceId, links: new Set(), record: { kind, id: String(row.id), title: String(row.title),
        reason: worktree ? "Task worktree needs attention." : !row[flag] ? "Active record." : !old ? "Within retention period or date unavailable." : "No retained record needs this record." } });
    }
  }
  const taskOwner = new Map<unknown, string>();
  for (const table of ["comments", "runs", "chat_sessions"] as const)
    for (const row of rows[table]) taskOwner.set(row.id, key("task", row.taskId));
  const roots = new Set<string>();
  const directIds = new Map<string, Set<string>>();
  function identify(id: string, target: string) {
    const targets = directIds.get(id) ?? new Set<string>();
    targets.add(target); directIds.set(id, targets);
  }
  for (const [id, node] of nodes) identify(node.record.id, id);
  for (const [id, owner] of taskOwner) identify(String(id), owner);
  function link(owner: string | undefined, target: string | undefined) {
    if (!target || !nodes.has(target)) return;
    if (owner && nodes.has(owner)) nodes.get(owner)!.links.add(target);
    else roots.add(target);
  }
  function href(owner: string | undefined, value: string) {
    const task = parseTaskReference(value);
    const comment = parseCommentReference(value);
    const artifact = parseArtifactMention(value);
    if (task || comment) link(owner, key("task", task ?? comment!.taskId));
    if (artifact) link(owner, key("artifact", artifact.artifactId));
  }
  function scan(owner: string | undefined, value: unknown) {
    if (typeof value === "string") {
      for (const target of directIds.get(value) ?? []) link(owner, target);
      href(owner, value);
      // JSON snapshots and tool records can contain both structured IDs and Markdown.
      if (/^[\[{]/.test(value)) {
        try { const parsed: unknown = JSON.parse(value); if (typeof parsed === "object") scan(owner, parsed); } catch { /* Also inspect as text. */ }
      }
      if (!/[#/?]/.test(value)) return;
      const tree = markdown.parse(value);
      function visit(node: Root | RootContent) {
        if (node.type === "link" || node.type === "image" || node.type === "definition") href(owner, node.url);
        if ("children" in node) for (const child of node.children) visit(child);
      }
      visit(tree);
      // Preserve raw references in saved tool output and text, including old revision links.
      for (const match of value.matchAll(/#(?:task|artifact|comment)\/[^\s<>"'`)\]\\]+|\/\?[^\s<>"'`)\]\\]+/g)) href(owner, match[0]);
    } else if (Array.isArray(value)) for (const item of value) scan(owner, item);
    else if (value && typeof value === "object" && !(value instanceof Uint8Array)) for (const item of Object.values(value)) scan(owner, item);
  }
  const digest = createHash("sha256").update(JSON.stringify({ workspaceId, retentionDays, asOf }));
  const artifactContent = db.prepare("SELECT content FROM artifacts WHERE id = ?");
  for (const table of tables) {
    digest.update(table);
    for (const row of rows[table]) {
      // Hash binary bytes directly instead of expanding each byte into JSON properties.
      const { content: savedContent, ...metadata } = row;
      const content = table === "artifacts" ? artifactContent.get(String(row.id))?.content : savedContent;
      digest.update(JSON.stringify(metadata));
      if (content instanceof Uint8Array) digest.update(createHash("sha256").update(content).digest());
      else digest.update(JSON.stringify(content ?? null));
      let owner: string | undefined;
      if (table === "tasks") owner = key("task", row.id);
      else if (table === "artifacts") owner = key("artifact", row.id);
      else if (table === "memory_entries") owner = key("memory", row.id);
      else if (table === "memory_versions") owner = key("memory", row.entryId);
      else if (["comments", "runs", "chat_sessions", "task_artifacts"].includes(table)) owner = key("task", row.taskId);
      else if (table === "comment_artifacts") owner = taskOwner.get(row.commentId);
      else if (table === "run_activity" || table === "memory_reviews") owner = taskOwner.get(row.runId);
      else if (table === "chat_messages") owner = taskOwner.get(row.sessionId);
      scan(owner, row);
      if (table === "artifacts" && content instanceof Uint8Array && (row.type === "text" || row.type === "markdown" || String(row.mediaType).startsWith("text/")))
        scan(owner, Buffer.from(content).toString("utf8"));
    }
  }
  // All non-candidates are roots. Walk outward, so isolated cycles remain removable.
  for (const [id, node] of nodes) if (!node.eligible) roots.add(id);
  const pending = [...roots];
  for (let index = 0; index < pending.length; index++) {
    for (const target of nodes.get(pending[index])?.links ?? []) if (!roots.has(target)) { roots.add(target); pending.push(target); }
  }
  const remove: CleanupRecord[] = [], keep: CleanupRecord[] = [];
  for (const [id, node] of nodes) {
    if (node.workspaceId !== workspaceId || !node.archived) continue;
    if (node.eligible && !roots.has(id)) remove.push(node.record);
    else keep.push({ ...node.record, reason: node.eligible ? "Referenced by retained content." : node.record.reason });
  }
  const now = new Date().toISOString();
  const busy = rows.runs.some(row => row.workspaceId === workspaceId && ["Queued", "Running"].includes(String(row.status))) ||
    [...rows.chat_sessions, ...rows.workspace_chats].some(row => row.workspaceId === workspaceId && String(row.lease ?? "") > now);
  return { retentionDays, asOf, token: digest.digest("hex"), remove, keep,
    counts: { task: remove.filter(row => row.kind === "task").length, artifact: remove.filter(row => row.kind === "artifact").length, memory: remove.filter(row => row.kind === "memory").length },
    blocked: busy ? "Stop active runs and chats. Clear queued runs before cleanup." : null };
}

// Caller holds BEGIN IMMEDIATE across preview validation and all deletions.
export function executeCleanup(db: DatabaseSync, workspaceId: string, confirmation: CleanupConfirmation) {
  const preview = previewCleanup(db, workspaceId, confirmation.retentionDays, confirmation.asOf);
  if (preview.token !== confirmation.token) throw new CleanupValidationError("Records changed. Preview cleanup again.");
  if (preview.blocked) throw new CleanupValidationError(preview.blocked);
  for (const record of preview.remove.filter(row => row.kind === "task")) {
    db.prepare("UPDATE task_usage SET taskId = NULL, runId = NULL WHERE workspaceId = ? AND taskId = ?").run(workspaceId, record.id);
    db.prepare("DELETE FROM tasks WHERE workspaceId = ? AND id = ?").run(workspaceId, record.id);
  }
  for (const record of preview.remove.filter(row => row.kind === "artifact"))
    db.prepare("DELETE FROM artifacts WHERE workspaceId = ? AND id = ?").run(workspaceId, record.id);
  for (const record of preview.remove.filter(row => row.kind === "memory")) {
    db.prepare("DELETE FROM memory_versions WHERE workspaceId = ? AND entryId = ?").run(workspaceId, record.id);
    db.prepare("DELETE FROM memory_entries WHERE workspaceId = ? AND id = ?").run(workspaceId, record.id);
  }
  return { counts: preview.counts };
}
