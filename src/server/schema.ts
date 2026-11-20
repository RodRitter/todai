import { initializeArtifactSchema } from "./artifact-schema.ts";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { migrateWorkspaceOwnership } from "./workspace-schema.ts";
import { statuses } from "../domain/task.ts";

// Keep schema creation and legacy migrations together, in their original order.
export function initializeSchema(db: DatabaseSync, seedWorkspace = true) {
  const fresh = !db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get();
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(`
      CREATE TABLE IF NOT EXISTS execution_control (
        id INTEGER PRIMARY KEY CHECK (id = 1), paused INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO execution_control (id) VALUES (1);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, tool TEXT NOT NULL,
        model TEXT NOT NULL, effort TEXT NOT NULL, instructions TEXT NOT NULL, permissions TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS column_assignments (
        column TEXT PRIMARY KEY, agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        status TEXT NOT NULL,
        agentStatus TEXT NOT NULL DEFAULT 'Not started'
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        body TEXT NOT NULL, createdAt TEXT NOT NULL
      );
    `);
  db.exec(`CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      column TEXT NOT NULL, profile TEXT NOT NULL, status TEXT NOT NULL,
      createdAt TEXT NOT NULL, startedAt TEXT, finishedAt TEXT, summary TEXT,
      ownerPid INTEGER, runnerPid INTEGER, ownerIdentity TEXT, runnerIdentity TEXT
    );`);
  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec(
      "CREATE TABLE IF NOT EXISTS board_columns (name TEXT PRIMARY KEY, position INTEGER NOT NULL)",
    );
    if (!db.prepare("PRAGMA table_info(board_columns)").all().some((column) => column.name === "workspaceId") && !db.prepare("SELECT name FROM board_columns LIMIT 1").get()) {
      for (const [position, name] of statuses.entries()) {
        db.prepare(
          "INSERT INTO board_columns (name, position) VALUES (?, ?)",
        ).run(name, position);
      }
    }
    const boardColumnFields = db.prepare("PRAGMA table_info(board_columns)").all();
    if (!boardColumnFields.some((column) => column.name === "id")) {
      db.exec("ALTER TABLE board_columns ADD COLUMN id TEXT");
    }
    for (const column of db.prepare("SELECT name FROM board_columns WHERE id IS NULL").all()) {
      db.prepare("UPDATE board_columns SET id = ? WHERE name = ?").run(randomUUID(), column.name);
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS board_columns_id ON board_columns(id)");
    const commentColumns = db.prepare("PRAGMA table_info(comments)").all();
    if (!commentColumns.some((column) => column.name === "authorName")) {
      db.exec(`ALTER TABLE comments ADD COLUMN authorName TEXT;
          UPDATE comments SET authorName = (
            SELECT json_extract(profile, '$.name') FROM runs
            WHERE runs.taskId = comments.taskId AND runs.finishedAt = comments.createdAt AND runs.summary = comments.body
          ) WHERE (SELECT COUNT(*) FROM runs
            WHERE runs.taskId = comments.taskId AND runs.finishedAt = comments.createdAt AND runs.summary = comments.body) = 1;
        `);
    }
    for (const column of ["recommendation", "feedbackStatus", "runId"]) {
      if (!commentColumns.some((item) => item.name === column))
        db.exec(`ALTER TABLE comments ADD COLUMN ${column} TEXT`);
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS one_pending_feedback ON comments(taskId) WHERE feedbackStatus = 'pending'");
    const runColumns = db.prepare("PRAGMA table_info(runs)").all();
    for (const column of [
      "stopRequested",
      "ownerIdentity",
      "runnerIdentity",
      "interruptionColumn",
      "kind",
      "commentId",
      "replyPlan",
    ]) {
      if (!runColumns.some((item) => item.name === column))
        db.exec(`ALTER TABLE runs ADD COLUMN ${column} TEXT`);
    }
    const columns = db.prepare("PRAGMA table_info(tasks)").all();
    if (!columns.some((column) => column.name === "autoWorkflow")) {
      db.exec(
        "ALTER TABLE tasks ADD COLUMN autoWorkflow INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!columns.some((column) => column.name === "autoRun")) {
      db.exec("ALTER TABLE tasks ADD COLUMN autoRun INTEGER NOT NULL DEFAULT 0");
    }
    if (columns.some((column) => column.name === "owner")) {
      db.exec("ALTER TABLE tasks DROP COLUMN owner");
    }
    if (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'column_agents'",
        )
        .get()
    ) {
      const legacy = db.prepare("SELECT * FROM column_agents").all();
      for (const agent of legacy) {
        const id = randomUUID();
        db.prepare(
          "INSERT INTO agents (id, name, tool, model, effort, instructions, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(
          id,
          agent.name,
          agent.tool,
          agent.model,
          agent.effort,
          agent.instructions,
          agent.permissions,
        );
        db.prepare(
          "INSERT INTO column_assignments (column, agentId) VALUES (?, ?)",
        ).run(agent.column, id);
      }
      db.exec("DROP TABLE column_agents");
    }
    migrateWorkspaceOwnership(db, !fresh || seedWorkspace);
    initializeArtifactSchema(db);
    db.exec("COMMIT");
  } catch (error) {
    db.close();
    throw error;
  }
}
