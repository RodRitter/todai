import type { DatabaseSync } from "node:sqlite";

export function initializeWorkspaceChatSchema(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS workspace_chats (
    id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL, tool TEXT NOT NULL, model TEXT NOT NULL, effort TEXT NOT NULL DEFAULT 'medium',
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, lease TEXT, ownerPid INTEGER, ownerIdentity TEXT, error TEXT
  );
  CREATE INDEX IF NOT EXISTS workspace_chats_owner ON workspace_chats(workspaceId, updatedAt);
  CREATE TABLE IF NOT EXISTS workspace_chat_messages (
    id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES workspace_chats(id) ON DELETE CASCADE,
    authorRole TEXT NOT NULL, authorName TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, model TEXT, effort TEXT
  );
  CREATE TABLE IF NOT EXISTS workspace_chat_activity (
    id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES workspace_chats(id) ON DELETE CASCADE,
    turnId TEXT NOT NULL, name TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL,
    result TEXT, mutation INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS workspace_chat_messages_session ON workspace_chat_messages(sessionId);
  CREATE INDEX IF NOT EXISTS workspace_chat_activity_session ON workspace_chat_activity(sessionId);`);
  if (!db.prepare("PRAGMA table_info(workspace_chats)").all().some(column => column.name === "effort")) db.exec("ALTER TABLE workspace_chats ADD COLUMN effort TEXT NOT NULL DEFAULT 'medium'");
  if (!db.prepare("PRAGMA table_info(workspace_chat_messages)").all().some(column => column.name === "effort")) db.exec("ALTER TABLE workspace_chat_messages ADD COLUMN effort TEXT");
}
