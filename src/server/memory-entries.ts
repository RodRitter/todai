import { normalizeTaskReferences } from "../domain/task-reference.ts";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { memoryCategories, type MemoryEntry, type MemoryChange, type MemoryContext, type MemorySearchResult } from "../domain/memory.ts";

export function initializeMemoryEntries(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS memory_entries (
    id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), revision INTEGER NOT NULL,
    category TEXT NOT NULL, title TEXT NOT NULL, statement TEXT NOT NULL, scope TEXT NOT NULL,
    source TEXT NOT NULL, updatedAt TEXT NOT NULL, removed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS memory_entries_workspace ON memory_entries(workspaceId, removed);
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_search USING fts5(title, statement, scope, content='memory_entries', content_rowid='rowid');
  CREATE TRIGGER IF NOT EXISTS memory_search_insert AFTER INSERT ON memory_entries BEGIN
    INSERT INTO memory_search(rowid, title, statement, scope) VALUES (new.rowid, new.title, new.statement, new.scope);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_search_delete AFTER DELETE ON memory_entries BEGIN
    INSERT INTO memory_search(memory_search, rowid, title, statement, scope) VALUES ('delete', old.rowid, old.title, old.statement, old.scope);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_search_update AFTER UPDATE ON memory_entries BEGIN
    INSERT INTO memory_search(memory_search, rowid, title, statement, scope) VALUES ('delete', old.rowid, old.title, old.statement, old.scope);
    INSERT INTO memory_search(rowid, title, statement, scope) VALUES (new.rowid, new.title, new.statement, new.scope);
  END;
  CREATE TABLE IF NOT EXISTS memory_entry_migrations (workspaceId TEXT PRIMARY KEY);`);
  if (!db.prepare("PRAGMA table_info(memory_reviews)").all().some((field) => field.name === "changes"))
    db.exec("ALTER TABLE memory_reviews ADD COLUMN changes TEXT");
  for (const row of db.prepare(`SELECT m.* FROM workspace_memory m WHERE revision = (SELECT MAX(revision) FROM workspace_memory WHERE workspaceId = m.workspaceId)
    AND NOT EXISTS (SELECT 1 FROM memory_entry_migrations WHERE workspaceId = m.workspaceId)`).all()) {
    replaceLegacyEntries(db, String(row.workspaceId), String(row.document));
  }
}

function entry(row: Record<string, unknown>): MemoryEntry {
  const { id, revision, category, title, statement, scope, source, updatedAt } = row;
  return { id, revision, category, title, statement: normalizeTaskReferences(String(statement)), scope, source: normalizeTaskReferences(String(source)), updatedAt } as MemoryEntry;
}

export function readMemoryEntries(db: DatabaseSync, workspaceId: string, ids: string[]): MemoryEntry[] {
  if (!Array.isArray(ids) || ids.length > 5 || ids.some((id) => typeof id !== "string")) throw new Error("Read at most five memory entries.");
  return ids.map((id) => {
    const row = db.prepare("SELECT * FROM memory_entries WHERE workspaceId = ? AND id = ? AND removed = 0").get(workspaceId, id);
    if (!row) throw new Error("Memory entry is unavailable in this workspace.");
    return entry(row);
  });
}

export function searchMemoryEntries(db: DatabaseSync, workspaceId: string, query = "", offset = 0, limit = 20): MemorySearchResult {
  const terms = query.slice(0, 1000).match(/[\p{L}\p{N}_]+/gu)?.slice(0, 30) ?? [];
  const match = terms.map((term) => `"${term}"`).join(" OR ");
  const from = match ? "memory_entries m JOIN memory_search ON memory_search.rowid = m.rowid" : "memory_entries m";
  const where = `m.workspaceId = ? AND m.removed = 0${match ? " AND memory_search MATCH ?" : ""}`;
  const args = match ? [workspaceId, match] : [workspaceId];
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${from} WHERE ${where}`).get(...args)!.count);
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const size = Math.max(1, Math.min(50, limit));
  const entries = db.prepare(`SELECT m.* FROM ${from} WHERE ${where} ORDER BY ${match ? "bm25(memory_search, 4, 1, 2), " : ""}m.title, m.id LIMIT ? OFFSET ?`).all(...args, size, start).map(entry);
  return { entries, total, hasMore: start + entries.length < total };
}

export function memoryContext(db: DatabaseSync, workspaceId: string, query: string): MemoryContext {
  const result = searchMemoryEntries(db, workspaceId, query, 0, 5);
  const entries: MemoryEntry[] = [];
  let remaining = 3950;
  for (const item of result.entries) {
    const size = JSON.stringify(item).length;
    if (size > remaining) continue;
    entries.push(item); remaining -= size;
  }
  const total = Number(db.prepare("SELECT COUNT(*) AS count FROM memory_entries WHERE workspaceId = ? AND removed = 0").get(workspaceId)!.count);
  return { entries, total };
}

function writeEntry(db: DatabaseSync, workspaceId: string, value: MemoryEntry) {
  db.prepare(`INSERT INTO memory_entries (id, workspaceId, revision, category, title, statement, scope, source, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,
    category=excluded.category, title=excluded.title, statement=excluded.statement, scope=excluded.scope,
    source=excluded.source, updatedAt=excluded.updatedAt, removed=0`).run(value.id, workspaceId, value.revision,
      value.category, value.title, value.statement, value.scope, value.source, value.updatedAt);
}

// Preserve legacy Markdown exactly within entries. No model rewrites accepted knowledge during migration.
export function replaceLegacyEntries(db: DatabaseSync, workspaceId: string, document: string) {
  db.prepare("UPDATE memory_entries SET removed = 1, revision = revision + 1 WHERE workspaceId = ? AND removed = 0").run(workspaceId);
  let category: MemoryEntry["category"] = "Terms";
  let lines: string[] = [];
  const flush = () => {
    const statement = lines.join("\n").trim(); lines = [];
    if (!statement) return;
    const title = statement.split("\n")[0].replace(/^[-*#\s]+/, "").slice(0, 100);
    writeEntry(db, workspaceId, { id: randomUUID(), revision: 1, category, title, statement,
      scope: "See the accepted text.", source: "See the accepted text.", updatedAt: new Date().toISOString() });
  };
  let fence: string | undefined;
  for (const line of document.split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker && !fence) fence = marker;
    else if (marker && fence && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
    const heading = !fence && line.match(/^## (Terms|Practices|Decisions|Preferences)\s*$/);
    if (heading) { flush(); category = heading[1] as MemoryEntry["category"]; }
    else if (!fence && !line.trim()) flush();
    else lines.push(line);
  }
  flush();
  db.prepare("INSERT OR IGNORE INTO memory_entry_migrations(workspaceId) VALUES (?)").run(workspaceId);
}

function field(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Memory ${name} must contain 1 to ${max} characters.`);
  return value.trim();
}

export function prepareMemoryChanges(db: DatabaseSync, workspaceId: string, input: unknown): MemoryChange[] {
  if (!Array.isArray(input) || input.length > 20) throw new Error("Propose at most 20 memory changes.");
  const seen = new Set<string>();
  return input.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid memory change.");
    const operation = raw.operation;
    if (!["add", "update", "remove"].includes(operation)) throw new Error("Use add, update, or remove for a memory change.");
    let before: MemoryEntry | undefined;
    if (operation !== "add") {
      before = readMemoryEntries(db, workspaceId, [field(raw.id, "ID", 100)])[0];
      if (raw.revision !== before.revision) throw new Error("Memory entry changed. Read its current revision before proposing an update.");
      if (seen.has(before.id)) throw new Error("Propose only one change per memory entry.");
      seen.add(before.id);
    }
    const reason = field(raw.reason, "reason", 300);
    if (operation === "remove") return { operation, reason, before };
    if (!memoryCategories.includes(raw.category)) throw new Error("Select a valid memory category.");
    const after: MemoryEntry = { id: before?.id ?? randomUUID(), revision: (before?.revision ?? 0) + 1,
      category: raw.category, title: field(raw.title, "title", 100), statement: field(raw.statement, "statement", 600),
      scope: field(raw.scope, "scope", 160), source: normalizeTaskReferences(field(raw.source, "source", 500)), updatedAt: new Date().toISOString() };
    return { operation, reason, before, after };
  });
}

export function applyMemoryChanges(db: DatabaseSync, workspaceId: string, changes: MemoryChange[]) {
  // The caller owns the transaction, so a conflict rolls back the complete approval.
  for (const change of changes) {
    if (change.before) {
      const row = db.prepare("SELECT revision FROM memory_entries WHERE workspaceId = ? AND id = ? AND removed = 0").get(workspaceId, change.before.id);
      if (row?.revision !== change.before.revision) throw new Error("Workspace memory changed after this review. Run the memory review again.");
    }
    if (change.after) {
      const duplicate = db.prepare("SELECT id FROM memory_entries WHERE workspaceId = ? AND removed = 0 AND statement = ? AND scope = ? AND id != ?").get(workspaceId, change.after.statement, change.after.scope, change.after.id);
      if (duplicate) throw new Error("This memory entry already exists. Run the memory review again.");
      writeEntry(db, workspaceId, change.after);
    } else if (change.before) db.prepare("UPDATE memory_entries SET removed = 1, revision = revision + 1 WHERE workspaceId = ? AND id = ?").run(workspaceId, change.before.id);
  }
  db.prepare("INSERT OR IGNORE INTO memory_entry_migrations(workspaceId) VALUES (?)").run(workspaceId);
}

export function memoryDocument(db: DatabaseSync, workspaceId: string): string {
  const entries = db.prepare("SELECT * FROM memory_entries WHERE workspaceId = ? AND removed = 0 ORDER BY category, title, id").all(workspaceId).map(entry);
  return memoryCategories.map((category) => `## ${category}\n\n${entries.filter((item) => item.category === category).map((item) => item.statement + (item.scope === "See the accepted text." ? "" : `\n\nScope: ${item.scope}\n\nSource: ${item.source}`)).join("\n\n")}`.trim()).join("\n\n");
}

export function memoryChangesSummary(changes: MemoryChange[]): string {
  return `${changes.filter((item) => item.operation === "add").length} added · ${changes.filter((item) => item.operation === "update").length} changed · ${changes.filter((item) => item.operation === "remove").length} removed`;
}
