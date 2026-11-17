import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

// Called inside the schema transaction, after all legacy columns exist.
export function migrateWorkspaceOwnership(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL
  )`);
  if (db.prepare("PRAGMA table_info(tasks)").all().some((column) => column.name === "workspaceId")) return;

  const id = randomUUID();
  const path = (db.prepare("SELECT value FROM settings WHERE key = 'workspacePath'").get()?.value as string | undefined) ?? resolve("workspace");
  db.prepare("INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)").run(id, basename(path) || "Workspace", path);
  for (const table of ["tasks", "agents", "runs", "comments"]) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN workspaceId TEXT REFERENCES workspaces(id)`);
    db.prepare(`UPDATE ${table} SET workspaceId = ?`).run(id);
    db.exec(`CREATE INDEX ${table}_workspace ON ${table}(workspaceId)`);
  }
  db.exec("ALTER TABLE runs ADD COLUMN workspacePath TEXT");
  db.prepare("UPDATE runs SET workspacePath = ?").run(path);

  // Names and setting keys are unique within a workspace, not across the app.
  db.exec(`
    ALTER TABLE board_columns RENAME TO legacy_board_columns;
    CREATE TABLE board_columns (
      id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, position INTEGER NOT NULL,
      workspaceId TEXT NOT NULL REFERENCES workspaces(id), PRIMARY KEY(workspaceId, name)
    );
    ALTER TABLE column_assignments RENAME TO legacy_column_assignments;
    CREATE TABLE column_assignments (
      column TEXT NOT NULL, agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      workspaceId TEXT NOT NULL REFERENCES workspaces(id), PRIMARY KEY(workspaceId, column)
    );
    ALTER TABLE settings RENAME TO legacy_settings;
    CREATE TABLE settings (
      key TEXT NOT NULL, value TEXT NOT NULL, workspaceId TEXT NOT NULL REFERENCES workspaces(id),
      PRIMARY KEY(workspaceId, key)
    );
  `);
  db.prepare("INSERT INTO board_columns SELECT id, name, position, ? FROM legacy_board_columns").run(id);
  db.prepare("INSERT INTO column_assignments SELECT column, agentId, ? FROM legacy_column_assignments").run(id);
  db.prepare("INSERT INTO settings SELECT key, value, ? FROM legacy_settings WHERE key <> 'workspacePath'").run(id);
  db.exec("DROP TABLE legacy_board_columns; DROP TABLE legacy_column_assignments; DROP TABLE legacy_settings;");
}
