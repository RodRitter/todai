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
  for (const [name, definition] of Object.entries({ details: "TEXT NOT NULL DEFAULT ''", needsReview: "INTEGER NOT NULL DEFAULT 0", supersedes: "TEXT NOT NULL DEFAULT ''" })) {
    if (!db.prepare("PRAGMA table_info(memory_entries)").all().some((column) => column.name === name))
      db.exec(`ALTER TABLE memory_entries ADD COLUMN ${name} ${definition}`);
  }
  if (!db.prepare("PRAGMA table_info(memory_search)").all().some((column) => column.name === "details")) {
    db.exec(`DROP TRIGGER memory_search_insert; DROP TRIGGER memory_search_delete; DROP TRIGGER memory_search_update;
      DROP TABLE memory_search;
      CREATE VIRTUAL TABLE memory_search USING fts5(title, statement, scope, details, content='memory_entries', content_rowid='rowid');
      CREATE TRIGGER memory_search_insert AFTER INSERT ON memory_entries BEGIN
        INSERT INTO memory_search(rowid, title, statement, scope, details) VALUES (new.rowid, new.title, new.statement, new.scope, new.details);
      END;
      CREATE TRIGGER memory_search_delete AFTER DELETE ON memory_entries BEGIN
        INSERT INTO memory_search(memory_search, rowid, title, statement, scope, details) VALUES ('delete', old.rowid, old.title, old.statement, old.scope, old.details);
      END;
      CREATE TRIGGER memory_search_update AFTER UPDATE ON memory_entries BEGIN
        INSERT INTO memory_search(memory_search, rowid, title, statement, scope, details) VALUES ('delete', old.rowid, old.title, old.statement, old.scope, old.details);
        INSERT INTO memory_search(rowid, title, statement, scope, details) VALUES (new.rowid, new.title, new.statement, new.scope, new.details);
      END;
      INSERT INTO memory_search(memory_search) VALUES ('rebuild');`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS memory_versions (
    workspaceId TEXT NOT NULL, entryId TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL,
    reason TEXT NOT NULL, PRIMARY KEY(workspaceId, entryId, revision)
  );`);
  for (const row of db.prepare(`SELECT m.* FROM workspace_memory m WHERE revision = (SELECT MAX(revision) FROM workspace_memory WHERE workspaceId = m.workspaceId)
    AND NOT EXISTS (SELECT 1 FROM memory_entry_migrations WHERE workspaceId = m.workspaceId)`).all()) {
    replaceLegacyEntries(db, String(row.workspaceId), String(row.document));
  }
}

function entry(row: Record<string, unknown>): MemoryEntry {
  const { id, revision, category, title, statement, scope, source, updatedAt } = row;
  return { id, revision, category, title, stale: Date.now() - Date.parse(String(updatedAt)) > 180 * 86400000, retired: Boolean(row.removed), details: String(row.details ?? ""), needsReview: Boolean(row.needsReview), supersedes: String(row.supersedes ?? ""), statement: normalizeTaskReferences(String(statement)), scope, source: normalizeTaskReferences(String(source)), updatedAt } as MemoryEntry;
}

export function readMemoryEntries(db: DatabaseSync, workspaceId: string, ids: string[]): MemoryEntry[] {
  if (!Array.isArray(ids) || ids.length > 5 || ids.some((id) => typeof id !== "string")) throw new Error("Read at most five memory entries.");
  return ids.map((id) => {
    const row = db.prepare("SELECT * FROM memory_entries WHERE workspaceId = ? AND id = ? AND removed = 0").get(workspaceId, id);
    if (!row) throw new Error("Memory entry is unavailable in this workspace.");
    return entry(row);
  });
}

// Local concept expansion is deterministic and does not send workspace text to a service.
const concepts = [
  ["authentication", "login", "signin", "credentials"], ["authorization", "permissions", "access"],
  ["notification", "notifications", "toast", "feedback"], ["database", "storage", "persistence", "sqlite"],
  ["test", "tests", "testing", "verification", "validation"], ["slow", "latency", "performance"],
  ["delete", "remove", "retire", "removal"], ["settings", "configuration", "preferences"],
  ["error", "failure", "failed", "exception"], ["concurrency", "parallel", "simultaneous"],
];
const stopWords = new Set("a an the to for in on of and or is are be use with this that how should we".split(" "));
function words(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter((word) => !stopWords.has(word)))];
}
function rankedMemory(db: DatabaseSync, workspaceId: string, query: string, includeRetired = false) {
  const terms = words(query.slice(0, 1000)).slice(0, 30);
  const related = new Set(concepts.filter((group) => group.some((term) => terms.includes(term))).flat());
  const match = [...new Set([...terms, ...related])].map((term) => `"${term}"`).join(" OR ");
  if (query.trim() && !match) return [];
  const rows = match
    ? db.prepare("SELECT m.* FROM memory_entries m JOIN memory_search ON memory_search.rowid = m.rowid WHERE m.workspaceId = ? AND (? OR m.removed = 0) AND memory_search MATCH ?").all(workspaceId, includeRetired ? 1 : 0, match)
    : db.prepare("SELECT * FROM memory_entries WHERE workspaceId = ? AND (? OR removed = 0)").all(workspaceId, includeRetired ? 1 : 0);
  const ranked = rows.map(entry).map((item) => {
    const fields = [[item.title, 4], [item.scope, 2], [item.statement, 1], [item.details ?? "", 0.5]] as const;
    let score = 0;
    for (const [text, weight] of fields) {
      const tokens = new Set(words(text));
      score += terms.filter((term) => tokens.has(term)).length * weight * 4;
      score += [...related].filter((term) => tokens.has(term) && !terms.includes(term)).length * weight;
    }
    return { item, score };
  }).filter(({ score }) => !query.trim() || score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title) || a.item.id.localeCompare(b.item.id));
  return ranked.map(({ item }) => item);
}
export function searchMemoryEntries(db: DatabaseSync, workspaceId: string, query = "", offset = 0, limit = 20, includeRetired = false): MemorySearchResult {
  const ranked = rankedMemory(db, workspaceId, query, includeRetired);
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const size = Number.isSafeInteger(limit) ? Math.max(1, Math.min(50, limit)) : 20;
  return { entries: ranked.slice(start, start + size), total: ranked.length, hasMore: start + size < ranked.length };
}

export function memoryContext(db: DatabaseSync, workspaceId: string, query: string, budget = Number(process.env.TODAI_MEMORY_CONTEXT_CHARACTERS ?? 8000)): MemoryContext {
  const entries: MemoryEntry[] = [];
  let remaining = (Number.isFinite(budget) ? Math.max(0, Math.min(64000, budget)) : 8000) - 2;
  for (const item of rankedMemory(db, workspaceId, query)) {
    if (item.needsReview) continue;
    const summary = { ...item, details: "" };
    const size = JSON.stringify(summary).length + (entries.length ? 1 : 0);
    if (size > remaining) continue;
    entries.push(summary); remaining -= size;
  }
  const total = Number(db.prepare("SELECT COUNT(*) AS count FROM memory_entries WHERE workspaceId = ? AND removed = 0").get(workspaceId)!.count);
  return { entries, total };
}

export function memoryHistory(db: DatabaseSync, workspaceId: string, id: string) {
  return db.prepare("SELECT snapshot, reason FROM memory_versions WHERE workspaceId = ? AND entryId = ? ORDER BY revision DESC").all(workspaceId, id)
    .map((row) => ({ entry: JSON.parse(String(row.snapshot)) as MemoryEntry, reason: String(row.reason) }));
}
function saveVersion(db: DatabaseSync, workspaceId: string, item: MemoryEntry, reason: string) {
  db.prepare("INSERT OR IGNORE INTO memory_versions VALUES (?, ?, ?, ?, ?)").run(workspaceId, item.id, item.revision, JSON.stringify(item), reason);
}

function writeEntry(db: DatabaseSync, workspaceId: string, value: MemoryEntry) {
  db.prepare(`INSERT INTO memory_entries (id, workspaceId, revision, category, title, statement, scope, source, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,
    category=excluded.category, title=excluded.title, statement=excluded.statement, scope=excluded.scope,
    source=excluded.source, updatedAt=excluded.updatedAt, removed=0`).run(value.id, workspaceId, value.revision,
      value.category, value.title, value.statement, value.scope, value.source, value.updatedAt);
  db.prepare("UPDATE memory_entries SET details = ?, needsReview = ?, supersedes = ? WHERE workspaceId = ? AND id = ?")
    .run(value.details ?? "", value.needsReview ? 1 : 0, value.supersedes ?? "", workspaceId, value.id);
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
  if (!Array.isArray(input)) throw new Error("Memory changes must be an array.");
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
      details: raw.details === undefined ? before?.details ?? "" : raw.details === "" ? "" : field(raw.details, "details", 12000),
      needsReview: raw.needsReview === undefined ? before?.needsReview ?? false : raw.needsReview,
      supersedes: raw.supersedes === undefined ? before?.supersedes ?? "" : raw.supersedes === "" ? "" : field(raw.supersedes, "supersedes", 100),
      scope: field(raw.scope, "scope", 160), source: normalizeTaskReferences(field(raw.source, "source", 500)), updatedAt: new Date().toISOString() };
    if (typeof after.needsReview !== "boolean") throw new Error("Memory review status must be a boolean.");
    if (after.supersedes && after.supersedes !== before?.supersedes) {
      if (after.supersedes === after.id) throw new Error("A memory cannot replace itself.");
      readMemoryEntries(db, workspaceId, [after.supersedes]);
    }
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
    if (change.before) saveVersion(db, workspaceId, change.before, "Previous accepted version.");
    if (change.after) {
      const duplicate = db.prepare("SELECT id FROM memory_entries WHERE workspaceId = ? AND removed = 0 AND statement = ? AND scope = ? AND id != ?").get(workspaceId, change.after.statement, change.after.scope, change.after.id);
      if (duplicate) throw new Error("This memory entry already exists. Run the memory review again.");
      const normalized = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const peers = db.prepare("SELECT * FROM memory_entries WHERE workspaceId = ? AND removed = 0 AND id != ?").all(workspaceId, change.after.id).map(entry);
      if (peers.some((peer) => normalized(peer.statement) === normalized(change.after!.statement) && normalized(peer.scope) === normalized(change.after!.scope)))
        throw new Error("This memory entry already exists. Update the existing entry.");
      const conflict = peers.some((peer) => normalized(peer.title) === normalized(change.after!.title) && normalized(peer.scope) === normalized(change.after!.scope) && peer.id !== change.after!.supersedes);
      if (conflict) {
        change.after.needsReview = true;
        for (const peer of peers.filter((peer) => !peer.needsReview && normalized(peer.title) === normalized(change.after!.title) && normalized(peer.scope) === normalized(change.after!.scope))) {
          saveVersion(db, workspaceId, peer, "Previous accepted version.");
          const flagged = { ...peer, needsReview: true, revision: peer.revision + 1 };
          writeEntry(db, workspaceId, flagged);
          saveVersion(db, workspaceId, flagged, "A record with the same title and scope needs conflict review.");
        }
      }
      if (change.after.supersedes && change.after.supersedes !== change.before?.supersedes) {
        const replaced = readMemoryEntries(db, workspaceId, [change.after.supersedes])[0];
        saveVersion(db, workspaceId, replaced, "Previous accepted version.");
        db.prepare("UPDATE memory_entries SET removed = 1, revision = revision + 1 WHERE workspaceId = ? AND id = ?").run(workspaceId, replaced.id);
        saveVersion(db, workspaceId, { ...replaced, retired: true, revision: replaced.revision + 1 }, `Replaced by ${change.after.id}.`);
      }
      writeEntry(db, workspaceId, change.after);
      saveVersion(db, workspaceId, change.after, change.reason);
    } else if (change.before) {
      db.prepare("UPDATE memory_entries SET removed = 1, revision = revision + 1 WHERE workspaceId = ? AND id = ?").run(workspaceId, change.before.id);
      saveVersion(db, workspaceId, { ...change.before, retired: true, revision: change.before.revision + 1 }, change.reason);
    }
  }
  db.prepare("INSERT OR IGNORE INTO memory_entry_migrations(workspaceId) VALUES (?)").run(workspaceId);
}

export function memoryDocument(db: DatabaseSync, workspaceId: string): string {
  const entries = db.prepare("SELECT * FROM memory_entries WHERE workspaceId = ? AND removed = 0 ORDER BY category, title, id").all(workspaceId).map(entry);
  return memoryCategories.map((category) => `## ${category}\n\n${entries.filter((item) => item.category === category).map((item) => item.statement + (item.details ? `\n\n${item.details}` : "") + (item.scope === "See the accepted text." ? "" : `\n\nScope: ${item.scope}\n\nSource: ${item.source}`)).join("\n\n")}`.trim()).join("\n\n");
}

export function memoryChangesSummary(changes: MemoryChange[]): string {
  return `${changes.filter((item) => item.operation === "add").length} added · ${changes.filter((item) => item.operation === "update").length} changed · ${changes.filter((item) => item.operation === "remove").length} removed`;
}
