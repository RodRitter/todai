import type { DatabaseSync } from "node:sqlite";

// Triggers cover imports and every archive/retirement writer, including legacy migrations.
export function initializeCleanupSchema(db: DatabaseSync) {
  // Date-only updates must not touch FTS before its AFTER INSERT trigger runs.
  if (db.prepare("SELECT name FROM sqlite_master WHERE name = 'memory_search'").get() &&
      !String(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'memory_search_update'").get()?.sql).includes("old.title IS NOT new.title")) {
    db.exec(`DROP TRIGGER IF EXISTS memory_search_update;
      CREATE TRIGGER memory_search_update AFTER UPDATE ON memory_entries
      WHEN old.title IS NOT new.title OR old.statement IS NOT new.statement
        OR old.scope IS NOT new.scope OR old.details IS NOT new.details BEGIN
        INSERT INTO memory_search(memory_search, rowid, title, statement, scope, details)
          VALUES ('delete', old.rowid, old.title, old.statement, old.scope, old.details);
        INSERT INTO memory_search(rowid, title, statement, scope, details)
          VALUES (new.rowid, new.title, new.statement, new.scope, new.details);
      END;`);
  }
  for (const [table, flag, date] of [["artifacts", "archived", "archivedAt"], ["memory_entries", "removed", "retiredAt"]]) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === date)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${date} TEXT;
        UPDATE ${table} SET ${date} = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE ${flag} = 1;`);
    }
    db.exec(`CREATE TRIGGER IF NOT EXISTS cleanup_${table}_insert AFTER INSERT ON ${table}
      WHEN new.${flag} = 1 AND new.${date} IS NULL BEGIN
        UPDATE ${table} SET ${date} = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = new.id;
      END;
      CREATE TRIGGER IF NOT EXISTS cleanup_${table}_update AFTER UPDATE OF ${flag} ON ${table}
      WHEN new.${flag} != old.${flag} BEGIN
        UPDATE ${table} SET ${date} = CASE WHEN new.${flag} = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END WHERE id = new.id;
      END;`);
  }
}
