import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { parseExecutionTool, executionTools } from "../domain/column-agent.ts";
import type { ChatModel, WorkspaceChat, WorkspaceChatSummary, WorkspaceChatActivity } from "../domain/workspace-chat.ts";
import type { TaskStore } from "./task-store.ts";
import { processIdentity } from "./process-identity.ts";

export function chatModel(input: unknown): ChatModel {
  if (!input || typeof input !== "object") throw new Error("Choose a model.");
  const { tool, model, effort = "medium" } = input as ChatModel;
  if (typeof model !== "string" || !model.trim() || model.length > 200) throw new Error("Enter a model ID of up to 200 characters.");
  const executor = parseExecutionTool(tool);
  if (!(executionTools.find(item => item.value === executor)!.efforts as readonly string[]).includes(effort)) throw new Error("Choose a supported effort level.");
  return { tool: executor, model: model.trim(), effort };
}
export class WorkspaceChatStore {
  private db: DatabaseSync;
  private tasks: TaskStore;
  constructor(tasks: TaskStore) {
    this.tasks = tasks;
    this.db = new DatabaseSync(tasks.databasePath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");
    for (const row of this.db.prepare("SELECT id, ownerPid, ownerIdentity, lease FROM workspace_chats WHERE workspaceId = ? AND lease IS NOT NULL").all(tasks.workspaceId)) {
      if (String(row.lease) <= new Date().toISOString() || !row.ownerPid || processIdentity(Number(row.ownerPid)) !== row.ownerIdentity) {
        this.db.prepare("UPDATE workspace_chats SET lease = NULL, error = ? WHERE id = ?").run("The response was interrupted. Send a message to continue.", row.id);
        this.db.prepare("UPDATE workspace_chat_activity SET status = 'error', result = ? WHERE sessionId = ? AND status = 'running'").run(JSON.stringify("The response was interrupted. Check the current settings before retrying."), row.id);
      }
    }
  }
  close() { this.db.close(); }
  private row(id: string) {
    const row = this.db.prepare("SELECT * FROM workspace_chats WHERE id = ? AND workspaceId = ?").get(id, this.tasks.workspaceId);
    if (!row) throw new Error("Chat not found in this workspace.");
    return row;
  }
  private summary(row: ReturnType<WorkspaceChatStore["row"]>): WorkspaceChatSummary {
    return { id: String(row.id), title: String(row.title), tool: parseExecutionTool(row.tool), model: String(row.model), effort: String(row.effort) as ChatModel["effort"],
      createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), running: !!row.lease && String(row.lease) > new Date().toISOString(), error: row.error as string | null };
  }
  list() { return this.db.prepare("SELECT * FROM workspace_chats WHERE workspaceId = ? ORDER BY updatedAt DESC, rowid DESC").all(this.tasks.workspaceId).map(row => this.summary(row)); }
  get(id: string): WorkspaceChat {
    return { ...this.summary(this.row(id)),
      messages: this.db.prepare("SELECT id, authorRole, authorName, body, createdAt, model, effort FROM workspace_chat_messages WHERE sessionId = ? ORDER BY rowid").all(id) as WorkspaceChat["messages"],
      activities: this.db.prepare("SELECT * FROM workspace_chat_activity WHERE sessionId = ? ORDER BY rowid").all(id).map(row => ({
        id: String(row.id), turnId: String(row.turnId), name: String(row.name), input: JSON.parse(String(row.input)), status: row.status as WorkspaceChatActivity["status"],
        result: row.result ? JSON.parse(String(row.result)) : undefined, mutation: !!row.mutation,
      })) };
  }
  create() {
    const id = randomUUID(), now = new Date().toISOString(), tool = this.tasks.getDefaultExecutor();
    this.db.prepare("INSERT INTO workspace_chats (id, workspaceId, title, tool, model, createdAt, updatedAt) VALUES (?, ?, 'New chat', ?, ?, ?, ?)")
      .run(id, this.tasks.workspaceId, tool, tool === "codex" ? "gpt-6.1-sol" : "sonnet", now, now);
    return this.get(id);
  }
  setModel(id: string, input: unknown) {
    const selection = chatModel(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.get(id).running) throw new Error("Wait for the response before changing the model.");
      this.db.prepare("UPDATE workspace_chats SET tool = ?, model = ?, effort = ?, updatedAt = ? WHERE id = ?")
        .run(selection.tool, selection.model, selection.effort, new Date().toISOString(), id);
      this.db.exec("COMMIT");
      return this.get(id);
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  rename(id: string, title: unknown) {
    this.row(id);
    if (typeof title !== "string" || !title.trim() || title.length > 120) throw new Error("Enter a title of up to 120 characters.");
    this.db.prepare("UPDATE workspace_chats SET title = ?, updatedAt = ? WHERE id = ?").run(title.trim(), new Date().toISOString(), id);
    return this.get(id);
  }
  delete(id: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.get(id).running) throw new Error("Wait for the response before deleting this chat.");
      this.db.prepare("DELETE FROM workspace_chats WHERE id = ?").run(id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  begin(id: string, body: unknown, input: unknown) {
    const selection = chatModel(input);
    if (typeof body !== "string" || !body.trim() || body.length > 100000) throw new Error("Enter a message of up to 100,000 characters.");
    // Usage recovery can write through the task store's connection. Complete it before taking this connection's write lock.
    const limit = this.tasks.getCreditLimit();
    if (limit > 0 && this.tasks.usage().trackedCredits().trackedCredits >= limit) throw new Error("The workspace credit limit was reached.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const session = this.get(id);
      if (session.running) throw new Error("Wait for the current response.");
      const lease = new Date(Date.now() + 360000).toISOString(), now = new Date().toISOString(), turnId = randomUUID();
      this.db.prepare("UPDATE workspace_chats SET tool = ?, model = ?, effort = ?, title = ?, lease = ?, ownerPid = ?, ownerIdentity = ?, error = NULL, updatedAt = ? WHERE id = ?")
        .run(selection.tool, selection.model, selection.effort, session.messages.length || session.title !== "New chat" ? session.title : body.trim().replace(/\s+/g, " ").slice(0, 80), lease, process.pid, processIdentity(process.pid) ?? null, now, id);
      this.db.prepare("INSERT INTO workspace_chat_messages (id, sessionId, authorRole, authorName, body, createdAt) VALUES (?, ?, 'human', ?, ?, ?)").run(turnId, id, this.tasks.getUserName() || "Human", body.trim(), now);
      this.db.exec("COMMIT");
      return { session: this.get(id), lease, turnId, generateTitle: !session.messages.length && session.title === "New chat" };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  setGeneratedTitle(id: string, lease: string, previousTitle: string, title: string) {
    this.assertLease(id, lease);
    this.db.prepare("UPDATE workspace_chats SET title = ? WHERE id = ? AND title = ?")
      .run(title, id, previousTitle);
  }
  assertLease(id: string, lease: string) {
    const row = this.row(id);
    if (row.lease !== lease || lease <= new Date().toISOString()) throw new Error("Chat tool access has expired.");
  }
  activity(id: string, lease: string, activity: WorkspaceChatActivity) {
    this.assertLease(id, lease);
    this.db.prepare(`INSERT INTO workspace_chat_activity (id, sessionId, turnId, name, input, status, result, mutation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, result = excluded.result`)
      .run(activity.id, id, activity.turnId, activity.name, JSON.stringify(activity.input), activity.status, activity.result === undefined ? null : JSON.stringify(activity.result), Number(activity.mutation));
  }
  finish(id: string, lease: string, body?: string, error: string | null = null) {
    this.assertLease(id, lease);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const session = this.get(id), now = new Date().toISOString();
      if (body) this.db.prepare("INSERT INTO workspace_chat_messages (id, sessionId, authorRole, authorName, body, createdAt, model, effort) VALUES (?, ?, 'agent', 'Assistant', ?, ?, ?, ?)").run(randomUUID(), id, body, now, session.model, session.effort);
      this.db.prepare("UPDATE workspace_chats SET lease = NULL, error = ?, updatedAt = ? WHERE id = ?").run(error, now, id);
      this.db.exec("COMMIT");
    } catch (failure) { this.db.exec("ROLLBACK"); throw failure; }
  }
}
