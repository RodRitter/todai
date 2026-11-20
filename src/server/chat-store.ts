import { removeConversationMessages } from "./conversation-messages.ts";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { TaskStore } from "./task-store.ts";
import type { ChatSession } from "../domain/chat.ts";
import type { AgentProfile } from "../domain/column-agent.ts";

export class ChatStore {
  private db: DatabaseSync;
  private tasks: TaskStore;
  constructor(tasks: TaskStore) {
    this.tasks = tasks;
    this.db = new DatabaseSync(tasks.databasePath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  }
  close() { this.db.close(); }
  private task(taskId: string) {
    const task = this.tasks.list().find((item) => item.id === taskId);
    if (!task) throw new Error("The task no longer exists.");
    return task;
  }
  private row(id: string) {
    const row = this.db.prepare("SELECT * FROM chat_sessions WHERE id = ? AND workspaceId = ?").get(id, this.tasks.workspaceId);
    if (!row) throw new Error("Chat session not found.");
    return row;
  }
  get(id: string, taskId?: string): ChatSession {
    const row = this.row(id);
    if (taskId !== undefined && row.taskId !== taskId) throw new Error("Chat session not found in this task.");
    const running = !!row.lease && Date.parse(String(row.lease)) > Date.now();
    return { id, taskId: String(row.taskId), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
      running, error: row.lease && !running ? "The response was interrupted. Send a message to continue." : row.error as string | null,
      messages: this.db.prepare("SELECT id, authorName, agentId, body, createdAt FROM chat_messages WHERE sessionId = ? ORDER BY createdAt, rowid").all(id)
        .map((message) => ({ ...message, taskId: String(row.taskId) })) as ChatSession["messages"] };
  }
  forTask(taskId: string) {
    this.task(taskId);
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO chat_sessions (id, workspaceId, taskId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspaceId, taskId) DO NOTHING")
      .run(randomUUID(), this.tasks.workspaceId, taskId, now, now);
    const row = this.db.prepare("SELECT id FROM chat_sessions WHERE workspaceId = ? AND taskId = ?").get(this.tasks.workspaceId, taskId)!;
    return this.get(String(row.id));
  }
  begin(taskId: string, body: unknown) {
    if (typeof body !== "string" || !body.trim() || body.length > 100000) throw new Error("Enter a message of up to 100,000 characters.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const session = this.forTask(taskId);
      if (session.running) throw new Error("The chat is already processing a message.");
      const task = this.task(taskId);
      const lease = new Date(Date.now() + 360000).toISOString();
      const now = new Date().toISOString();
      this.db.prepare("UPDATE chat_sessions SET lease = ?, error = NULL, updatedAt = ? WHERE id = ?").run(lease, now, session.id);
      this.db.prepare("INSERT INTO chat_messages (id, sessionId, authorName, body, createdAt) VALUES (?, ?, 'Human', ?, ?)")
        .run(randomUUID(), session.id, body.trim(), now);
      this.db.exec("COMMIT");
      return { session: this.get(session.id), task, lease };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  append(id: string, lease: string, body: string, agent: AgentProfile) {
    this.row(id);
    const now = new Date().toISOString();
    const result = this.db.prepare(`INSERT INTO chat_messages (id, sessionId, authorName, body, createdAt, agentId)
      SELECT ?, id, ?, ?, ?, ? FROM chat_sessions WHERE id = ? AND workspaceId = ? AND lease = ? AND lease > ?`)
      .run(randomUUID(), agent.name, body, now, agent.id, id, this.tasks.workspaceId, lease, now);
    if (!result.changes) throw new Error("The chat response expired. Send a message to continue.");
  }
  deleteMessage(taskId: string, messageId: unknown) {
    if (typeof messageId !== "string" || !messageId) throw new Error("A message ID is required.");
    return this.removeMessages(taskId, messageId);
  }
  clear(taskId: string) {
    return this.removeMessages(taskId);
  }
  private removeMessages(taskId: string, messageId?: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.task(taskId);
      const row = this.db.prepare("SELECT id FROM chat_sessions WHERE workspaceId = ? AND taskId = ?").get(this.tasks.workspaceId, taskId);
      if (!row) throw new Error("Chat message not found.");
      const session = this.get(String(row.id));
      if (session.running) throw new Error("Wait for the chat response before deleting messages.");
      if (messageId && !session.messages.some((message) => message.id === messageId)) throw new Error("Chat message not found.");
      removeConversationMessages(this.db, { kind: "chat", workspaceId: this.tasks.workspaceId, taskId, sessionId: session.id }, session.messages, messageId);
      if (!messageId) this.db.prepare("UPDATE chat_sessions SET lease = NULL, error = NULL WHERE id = ?").run(session.id);
      this.db.prepare("UPDATE chat_sessions SET updatedAt = ? WHERE id = ?").run(new Date().toISOString(), session.id);
      this.db.exec("COMMIT");
      return this.get(session.id);
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  finish(id: string, lease: string, error: string | null = null) {
    this.row(id);
    this.db.prepare("UPDATE chat_sessions SET lease = NULL, error = ?, updatedAt = ? WHERE id = ? AND lease = ?")
      .run(error, new Date().toISOString(), id, lease);
  }
}
