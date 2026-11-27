import type { DatabaseSync } from "node:sqlite";

// Existing workspaces retain their original board, columns, tasks and assignments.
export function migrateBoards(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL,
    UNIQUE(workspaceId, name COLLATE NOCASE)
  )`);
  if (!db.prepare("PRAGMA table_info(boards)").all().some((field) => field.name === "position")) {
    db.exec("ALTER TABLE boards ADD COLUMN position INTEGER NOT NULL DEFAULT 0; UPDATE boards SET position = rowid;");
  }
  if (!db.prepare("PRAGMA table_info(boards)").all().some((field) => field.name === "description")) {
    db.exec("ALTER TABLE boards ADD COLUMN description TEXT NOT NULL DEFAULT 'Organize and track tasks on this board.';");
  }
  if (db.prepare("PRAGMA table_info(tasks)").all().some((field) => field.name === "boardId")) return;
  db.exec(`INSERT INTO boards (id, workspaceId, name) SELECT id, id, 'Board' FROM workspaces;
    ALTER TABLE tasks ADD COLUMN boardId TEXT REFERENCES boards(id);
    UPDATE tasks SET boardId = workspaceId;
    CREATE INDEX tasks_board ON tasks(boardId);
    ALTER TABLE board_columns RENAME TO old_board_columns;
    CREATE TABLE board_columns (
      id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, position INTEGER NOT NULL,
      workspaceId TEXT NOT NULL REFERENCES workspaces(id), boardId TEXT NOT NULL REFERENCES boards(id),
      PRIMARY KEY(boardId, name)
    );
    INSERT INTO board_columns SELECT id, name, position, workspaceId, workspaceId FROM old_board_columns;
    DROP TABLE old_board_columns;
    ALTER TABLE column_assignments RENAME TO old_column_assignments;
    CREATE TABLE column_assignments (
      column TEXT NOT NULL, agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      workspaceId TEXT NOT NULL REFERENCES workspaces(id), boardId TEXT NOT NULL REFERENCES boards(id),
      PRIMARY KEY(boardId, column)
    );
    INSERT INTO column_assignments SELECT column, agentId, workspaceId, workspaceId FROM old_column_assignments;
    DROP TABLE old_column_assignments;`);
}
