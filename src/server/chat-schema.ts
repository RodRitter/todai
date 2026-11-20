import { commentReference } from "../domain/comment-reference.ts";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// Runs inside the schema transaction. Preserve every legacy conversation and its source context.
export function initializeChatSchema(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, lease TEXT, error TEXT
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    authorName TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, agentId TEXT
  );`);
  if (!db.prepare("PRAGMA table_info(chat_messages)").all().some((column) => column.name === "agentId")) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN agentId TEXT");
  }
  if (db.prepare("PRAGMA table_info(chat_sessions)").all().some((column) => column.name === "source")) {
    const sessions = db.prepare("SELECT * FROM chat_sessions ORDER BY createdAt, rowid").all();
    const canonical = new Map<string, string>();
    for (const row of sessions) {
      const key = JSON.stringify([row.workspaceId, row.taskId]);
      const id = canonical.get(key) ?? String(row.id);
      canonical.set(key, id);
      const profile = JSON.parse(String(row.profile));
      const source = JSON.parse(String(row.source));
      db.prepare("INSERT INTO chat_messages (id, sessionId, authorName, body, createdAt, agentId) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), id, source.authorName || "Agent", `Source comment from an earlier chat:\n\n${commentReference({ ...source, id: String(row.commentId), taskId: String(row.taskId) })}\n\n${source.body}${source.recommendation ? `\n\nRecommendation: ${source.recommendation}` : ""}`, row.createdAt, source.authorName === profile.name ? profile.id : null);
      db.prepare("UPDATE chat_messages SET agentId = ? WHERE sessionId = ? AND authorName = ?").run(profile.id, row.id, profile.name);
      db.prepare("UPDATE chat_messages SET sessionId = ? WHERE sessionId = ?").run(id, row.id);
      db.prepare("UPDATE chat_sessions SET updatedAt = MAX(updatedAt, ?), lease = NULL, error = COALESCE(?, error) WHERE id = ?")
        .run(row.updatedAt, row.lease ? "A response was interrupted during the chat update. Send a message to continue." : row.error, id);
      if (id !== row.id) db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(row.id);
    }
    for (const column of ["commentId", "title", "profile", "source"]) db.exec(`ALTER TABLE chat_sessions DROP COLUMN ${column}`);
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS chat_task ON chat_sessions(workspaceId, taskId)");
}
