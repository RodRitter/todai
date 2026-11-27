import { previewCleanup, executeCleanup } from "./workspace-cleanup.ts";
import type { CleanupConfirmation } from "../domain/workspace-cleanup.ts";
import { exportMemory, importMemory } from "./memory-transfer.ts";
import { discardWorktree, closeWorktree, openWorktree, planWorktree, validateBranchName, worktreeHead } from "./task-worktree.ts";
import type { TaskWorktree } from "../domain/task.ts";
import { searchMemoryEntries, readMemoryEntries, memoryContext, memoryHistory, prepareMemoryChanges, applyMemoryChanges, memoryDocument, memoryChangesSummary } from "./memory-entries.ts";
import { readMemory, readMemorySnapshot, memoryProfile } from "./workspace-memory.ts";
import { parseCredits } from "../domain/credit-settings.ts";
import { UsageStore } from "./usage-store.ts";
import { conversationDeletion, removeConversationMessages } from "./conversation-messages.ts";
import { groupActivity } from "../domain/activity.ts";
import { parseUserName } from "../domain/user-name.ts";
import { parseWorkspaceSetup, starterAgentProfile } from "../domain/workspace-setup.ts";
import type { ArtifactReference } from "../domain/artifact.ts";
import { artifactMentions } from "./artifact-mentions.ts";
import { mentionedAgentIds } from "../domain/agent-mentions.ts";
import { intentProfile } from "./comment-intent.ts";
import { parseConfiguration, ConfigurationValidationError, type Configuration } from "../domain/configuration.ts";
import { initializeSchema } from "./schema.ts";
import {
  AgentValidationError,
  parseAgentProfile,
  parseExecutionTool,
  type AgentProfile,
  type ColumnAssignment,
} from "../domain/column-agent.ts";
import { validateWorkspace } from "./workspace-settings.ts";
import { processIdentity } from "./process-identity.ts";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type Task, type TaskComment } from "../domain/task.ts";

import type { RunActivity, RunActivityUpdate, ExecutionState } from "../domain/execution.ts";
import type { Workspace } from "../domain/workspace.ts";
export type { Workspace } from "../domain/workspace.ts";
export class WorkspaceOwnershipError extends Error {}

export class ColumnValidationError extends Error {}

export class RunValidationError extends Error {}

export class PendingRunError extends Error {}
export class FeedbackValidationError extends Error {}
export class CommentValidationError extends Error {}

export type AgentRun = {
  workspaceId: string;
  workspacePath: string;
  id: string;
  taskId: string;
  column: Task["status"];
  profile: AgentProfile;
  columnInstructions?: string;
  status: "Queued" | "Running" | "Complete" | "Failed" | "Interrupted" | "Stopped" | "Waiting";
  kind?: "intent" | "reply" | "memory" | null;
  commentId?: string | null;
  replyPlan?: AgentProfile[] | null;
  stopRequested?: string | null;
  interruptionColumn?: Task["status"] | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
  ownerPid: number | null;
  runnerPid: number | null;
  ownerIdentity?: string | null;
  runnerIdentity?: string | null;
};

export class TaskStore {
  private db: DatabaseSync;

  private workspaceScope: string;
  get workspaceId(): string { return this.workspaceScope; }
  readonly databasePath: string;
  private boardScope: string;
  get boardId(): string { return this.boardScope; }

  constructor(path: string, workspaceId?: string, options: { seedWorkspace?: boolean; boardId?: string } = {}) {
    this.databasePath = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    initializeSchema(this.db, options.seedWorkspace);
    this.workspaceScope = workspaceId ?? (this.listWorkspaces()[0] ?? this.listArchivedWorkspaces()[0])?.id ?? "";
    if (workspaceId && !this.listWorkspaces().some((workspace) => workspace.id === workspaceId)) {
      this.db.close();
      throw new WorkspaceOwnershipError("Choose an existing workspace. Archived workspaces must be restored first.");
    }
    this.boardScope = options.boardId ?? this.workspaceId;
    // The SQL scope belongs to this connection and never follows a selected UI view.
    this.db.function("workspace_id", () => this.workspaceId);
    this.db.function("board_id", () => this.boardId);
    try { if (options.boardId) this.requireBoard(options.boardId); }
    catch (error) { this.db.close(); throw error; }
  }

  previewCleanup(retentionDays: number) {
    return this.transaction(() => previewCleanup(this.db, this.workspaceId, retentionDays));
  }

  executeCleanup(confirmation: CleanupConfirmation) {
    return this.transaction(() => executeCleanup(this.db, this.workspaceId, confirmation));
  }

  listWorkspaces(): Workspace[] {
    return this.db.prepare("SELECT id, name, path FROM workspaces WHERE archived = 0 ORDER BY rowid").all() as Workspace[];
  }

  listArchivedWorkspaces(): Workspace[] {
    return this.db.prepare("SELECT id, name, path FROM workspaces WHERE archived = 1 ORDER BY rowid").all() as Workspace[];
  }

  setWorkspaceArchived(id: string, archived: boolean) {
    return this.transaction(() => {
      if (!this.db.prepare("SELECT id FROM workspaces WHERE id = ?").get(id))
        throw new WorkspaceOwnershipError("Choose an existing workspace.");
      if (archived && this.db.prepare("SELECT id FROM workspace_chats WHERE workspaceId = ? AND lease > ?").get(id, new Date().toISOString()))
        throw new RunValidationError("Wait for workspace chats before archiving this workspace.");
      if (archived && this.db.prepare("SELECT id FROM runs WHERE workspaceId = ? AND status IN ('Queued', 'Running')").get(id))
        throw new RunValidationError("Finish queued and running jobs before archiving this workspace.");
      this.db.prepare("UPDATE workspaces SET archived = ? WHERE id = ?").run(Number(archived), id);
    });
  }

  private assertWorkspaceActive() {
    if (this.db.prepare("SELECT archived FROM workspaces WHERE id = workspace_id()").get()?.archived)
      throw new WorkspaceOwnershipError("This workspace is archived. Restore it before making changes.");
  }

  createWorkspace(name: string, path: string, options: unknown = {}): Workspace {
    const setup = parseWorkspaceSetup(options);
    if (!name.trim()) throw new WorkspaceOwnershipError("Enter a workspace name.");
    const workspace = { id: randomUUID(), name: name.trim(), path: validateWorkspace(path) };
    return this.transaction(() => {
      this.db.prepare("INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)").run(workspace.id, workspace.name, workspace.path);
      this.db.prepare("INSERT INTO boards (id, workspaceId, name) VALUES (?, ?, ?)").run(workspace.id, workspace.id, "Board");
      for (const [position, column] of setup.columns.entries()) {
        this.db.prepare("INSERT INTO board_columns (id, name, position, workspaceId, boardId) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), column, position, workspace.id, workspace.id);
      }
      for (const id of setup.starterAgentIds) {
        const agent = starterAgentProfile(id, randomUUID());
        this.db.prepare("INSERT INTO agents (workspaceId, id, name, tool, model, effort, instructions, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(workspace.id, agent.id, agent.name, agent.tool, agent.model, agent.effort, agent.instructions, agent.permissions);
      }
      if (setup.userName !== undefined) this.setUserName(setup.userName);
      return workspace;
    });
  }

  private assertOwnership(table: "tasks" | "agents" | "runs" | "board_columns", id: string) {
    const row = this.db.prepare(`SELECT workspaceId FROM ${table} WHERE id = ?`).get(id);
    if (row && row.workspaceId !== this.workspaceId)
      throw new WorkspaceOwnershipError("This reference belongs to another workspace.");
  }

  private assertInputOwnership(input: unknown) {
    if (input && typeof input === "object" && "workspaceId" in input && input.workspaceId !== this.workspaceId)
      throw new WorkspaceOwnershipError("This data belongs to another workspace.");
  }

  getCreditLimit(): number {
    return Number(this.db.prepare("SELECT value FROM settings WHERE key = 'creditLimit' AND workspaceId = workspace_id()").get()?.value ?? 0);
  }

  setCreditLimit(value: unknown): number {
    const limit = parseCredits(value);
    this.db.prepare("INSERT INTO settings (key, value, workspaceId) VALUES ('creditLimit', ?, workspace_id()) ON CONFLICT(workspaceId, key) DO UPDATE SET value = excluded.value").run(String(limit));
    return limit;
  }

  getUserName(): string {
    return String(this.db.prepare("SELECT value FROM general_settings WHERE key = 'userName'").get()?.value ?? "");
  }

  setUserName(value: unknown): string {
    const name = parseUserName(value);
    this.db.prepare("INSERT INTO general_settings (key, value) VALUES ('userName', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(name);
    return name;
  }

  getWorkspace(): Workspace {
    return this.db.prepare("SELECT id, name, path FROM workspaces WHERE id = workspace_id()").get() as Workspace;
  }

  getDefaultExecutor() {
    const value = this.db.prepare("SELECT value FROM settings WHERE key = 'defaultExecutor' AND workspaceId = workspace_id()").get()?.value;
    return value === undefined ? "codex" as const : parseExecutionTool(value);
  }

  setDefaultExecutor(value: unknown) {
    const tool = parseExecutionTool(value);
    this.db.prepare("INSERT INTO settings (key, value, workspaceId) VALUES ('defaultExecutor', ?, workspace_id()) ON CONFLICT(workspaceId, key) DO UPDATE SET value = excluded.value").run(tool);
    return tool;
  }

  getWorkspacePath(): string {
    return this.getWorkspace().path;
  }

  getWorktreesEnabled(): boolean {
    return this.db.prepare("SELECT value FROM settings WHERE key = 'worktreesEnabled' AND workspaceId = workspace_id()").get()?.value === "true";
  }

  setWorktreesEnabled(value: unknown): boolean {
    if (typeof value !== "boolean") throw new RunValidationError("Choose whether to use task worktrees.");
    return this.transaction(() => {
      this.assertWorkspaceActive();
      if (value === this.getWorktreesEnabled()) return value;
      if (this.db.prepare("SELECT id FROM workspace_chats WHERE workspaceId = workspace_id() AND lease > ?").get(new Date().toISOString()))
        throw new RunValidationError("Wait for workspace chats before changing task worktrees.");
      if (this.db.prepare("SELECT id FROM runs WHERE workspaceId = workspace_id() AND status = 'Running' LIMIT 1").get() ||
          this.db.prepare("SELECT id FROM chat_sessions WHERE workspaceId = workspace_id() AND lease > ? LIMIT 1").get(new Date().toISOString()))
        throw new RunValidationError("Stop running agents and wait for chats to finish before changing task worktrees.");
      this.db.prepare("INSERT INTO settings (key, value, workspaceId) VALUES ('worktreesEnabled', ?, workspace_id()) ON CONFLICT(workspaceId, key) DO UPDATE SET value = excluded.value").run(String(value));
      return value;
    });
  }

  executionTask(taskId: string): Task {
    const task = this.readTask(taskId);
    if (!task) throw new Error("This task no longer exists.");
    return this.getWorktreesEnabled() ? task : { ...task, worktree: null };
  }

  setWorkspacePath(path: string) {
    return this.transaction(() => {
      this.assertWorkspaceActive();
      if (path === this.getWorkspacePath()) return;
      if (this.db.prepare("SELECT id FROM workspace_chats WHERE workspaceId = workspace_id() AND lease > ?").get(new Date().toISOString()))
        throw new RunValidationError("Wait for workspace chats before changing this directory.");
      const state = this.executionState();
      if (state.active) throw new RunValidationError("Stop the running agent before changing a directory.");
      if (!state.paused && this.history().some((run) => run.status === "Queued"))
        throw new RunValidationError("Pause the global queue before changing this directory.");
      this.db.prepare("UPDATE workspaces SET path = ? WHERE id = workspace_id()").run(path);
    });
  }

  private requireBoard(id: string) {
    if (!this.db.prepare("SELECT id FROM boards WHERE id = ? AND workspaceId = workspace_id()").get(id))
      throw new ColumnValidationError("Choose an existing board in this workspace.");
  }

  listBoards(): import("../domain/task.ts").Board[] {
    return this.db.prepare("SELECT id, name, description FROM boards WHERE workspaceId = workspace_id() ORDER BY position, rowid").all()
      .map((row) => ({ id: row.id as string, name: row.name as string, description: row.description as string, columns: this.listColumns(row.id as string) }));
  }

  reorderBoards(ids: unknown) {
    return this.transaction(() => {
      this.assertWorkspaceActive();
      const boards = this.listBoards();
      if (!Array.isArray(ids) || ids.length !== boards.length || new Set(ids).size !== ids.length ||
          ids.some((id) => typeof id !== "string" || !boards.some((board) => board.id === id)))
        throw new ColumnValidationError("Include each board in this workspace exactly once.");
      this.writeBoardOrder(ids);
      return this.listBoards();
    });
  }

  private writeBoardOrder(ids: string[]) {
    const update = this.db.prepare("UPDATE boards SET position = ? WHERE id = ? AND workspaceId = workspace_id()");
    ids.forEach((id, position) => update.run(position, id));
  }

  saveBoard(name: unknown, id?: string, description?: unknown) {
    return this.transaction(() => {
      this.assertWorkspaceActive();
      if (typeof name !== "string" || !name.trim() || name.trim().length > 80)
        throw new ColumnValidationError("Enter a board name between 1 and 80 characters.");
      if (description !== undefined && (typeof description !== "string" || !description.trim() || description.trim().length > 500))
        throw new ColumnValidationError("Enter a board description between 1 and 500 characters.");
      if (id) this.requireBoard(id);
      if (this.listBoards().some((board) => board.id !== id && board.name.toLowerCase() === name.trim().toLowerCase()))
        throw new ColumnValidationError("A board with that name already exists.");
      const boardId = id ?? randomUUID();
      if (id) this.db.prepare("UPDATE boards SET name = ? WHERE id = ?").run(name.trim(), id);
      else {
        this.db.prepare("INSERT INTO boards (id, workspaceId, name, position) VALUES (?, workspace_id(), ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM boards WHERE workspaceId = workspace_id()))").run(boardId, name.trim());
        for (const [position, column] of ["To do", "In progress", "In review", "Done"].entries())
          this.db.prepare("INSERT INTO board_columns (id, workspaceId, boardId, name, position) VALUES (?, workspace_id(), ?, ?, ?)").run(randomUUID(), boardId, column, position);
      }
      if (typeof description === "string")
        this.db.prepare("UPDATE boards SET description = ? WHERE id = ?").run(description.trim(), boardId);
      return this.listBoards().find((board) => board.id === boardId)!;
    });
  }

  deleteBoard(id: string) {
    return this.transaction(() => {
      this.assertWorkspaceActive();
      this.requireBoard(id);
      if (id === this.workspaceId) throw new ColumnValidationError("Keep the original board as the default board.");
      if (this.db.prepare("SELECT id FROM tasks WHERE boardId = ? LIMIT 1").get(id))
        throw new ColumnValidationError("Move all tasks to another board before deleting this board.");
      this.db.prepare("DELETE FROM column_assignments WHERE boardId = ?").run(id);
      this.db.prepare("DELETE FROM board_columns WHERE boardId = ?").run(id);
      this.db.prepare("DELETE FROM boards WHERE id = ?").run(id);
    });
  }

  boardSnapshot() {
    return this.transaction(() => ({
      tasks: this.list().filter((task) => task.boardId === this.boardId),
      columns: this.listColumns(),
      columnInstructions: this.columnInstructions(),
      completionColumn: this.completionColumn(),
      worktreesEnabled: this.getWorktreesEnabled(),
      assignments: this.listColumnAgents(),
    }));
  }

  exportConfiguration(workspace = false): Configuration {
    return this.transaction(() => {
      const memory = exportMemory(this.db, this.workspaceId);
      const selected: Configuration = {
        format: "todai-configuration", version: 1,
        name: this.listBoards().find((board) => board.id === this.boardId)!.name,
        ...(memory ? { memory } : {}),
        agents: this.listAgents(),
        ...this.exportBoardConfiguration(),
      };
      if (!workspace) return selected;
      const previousBoard = this.boardScope;
      try {
        const boards = this.listBoards().map((board) => {
          this.boardScope = board.id;
          const content = this.exportBoardConfiguration();
          return { id: board.id, name: board.name, description: board.description, columns: content.columns, assignments: content.assignments };
        });
        return { ...selected, name: this.listWorkspaces().find((workspace) => workspace.id === this.workspaceId)!.name, boards, defaultBoardId: this.workspaceId };
      } finally { this.boardScope = previousBoard; }
    });
  }

  private exportBoardConfiguration(): Pick<Configuration, "columns" | "assignments"> {
    const columns = this.db.prepare("SELECT id, name, instructions, completion FROM board_columns WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() ORDER BY position").all() as { id: string; name: string; instructions: string; completion: number }[];
    return {
      columns: columns.map(({ completion, ...column }) => ({ ...column, ...(completion ? { completion: true } : {}) })),
      assignments: this.listColumnAgents().map((assignment) => ({
        columnId: columns.find((column) => column.name === assignment.column)!.id,
        agentId: assignment.agentId,
      })),
    };
  }

  private applyWorkspaceConfiguration(data: Configuration) {
    const boards = data.boards!;
    const existingBoards = this.listBoards();
    const nextPosition = Number(this.db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM boards WHERE workspaceId = workspace_id()").get()!.position);
    const names = new Set(existingBoards.map((board) => board.name.toLowerCase()));
    let importedDefaultBoard = this.boardId;
    // Copy agents once so all imported boards share the same profiles.
    const agentIds = new Map<string, string>();
    for (const agent of data.agents) {
      const id = randomUUID();
      this.saveAgent({ ...agent, id });
      agentIds.set(agent.id, id);
    }
    for (const [position, board] of boards.entries()) {
      const id = randomUUID();
      let name = board.name;
      let suffix = 2;
      while (names.has(name.toLowerCase())) {
        const ending = ` (imported ${suffix++})`;
        name = board.name.slice(0, 80 - ending.length) + ending;
      }
      names.add(name.toLowerCase());
      this.db.prepare("INSERT INTO boards (id, workspaceId, name, description, position) VALUES (?, ?, ?, ?, ?)").run(id, this.workspaceId, name, board.description ?? "", nextPosition + position);
      if (board.id === data.defaultBoardId) importedDefaultBoard = id;
      this.boardScope = id;
      this.applyConfiguration({ format: data.format, version: data.version, agents: [], columns: board.columns, assignments: [] }, "replace", "copy");
      for (const assignment of board.assignments) {
        this.assignColumnAgent({ column: board.columns.find((column) => column.id === assignment.columnId)!.name, agentId: agentIds.get(assignment.agentId)! });
      }
    }
    const memory = data.memory?.entries.length ? importMemory(this.db, this.workspaceId, importedDefaultBoard, data.memory) : 0;
    return { boards: boards.length, agents: data.agents.length, columns: boards.reduce((count, board) => count + board.columns.length, 0), assignments: boards.reduce((count, board) => count + board.assignments.length, 0), memory };
  }

  importConfiguration(input: unknown, columnMode: unknown = "add", conflictMode: unknown = "copy") {
    if (columnMode !== "add" && columnMode !== "replace")
      throw new ConfigurationValidationError("Choose whether to add or replace columns.");
    if (conflictMode !== "copy" && conflictMode !== "overwrite")
      throw new ConfigurationValidationError("Choose whether to overwrite matching IDs or create copies.");
    const data = parseConfiguration(input);
    if (data.boards) {
      if (columnMode !== "add" || conflictMode !== "copy")
        throw new ConfigurationValidationError("Workspace imports add new copies of boards and agents.");
      return this.transaction(() => {
        this.assertWorkspaceActive();
        const previousBoard = this.boardScope;
        try { return this.applyWorkspaceConfiguration(data); }
        finally { this.boardScope = previousBoard; }
      });
    }
    if (!data.agents.length && !data.columns.length && !data.memory?.entries.length)
      throw new ConfigurationValidationError("Select at least one agent, column, or memory entry.");
    return this.transaction(() => this.applyConfiguration(data, columnMode, conflictMode));
  }

  private applyConfiguration(data: Configuration, columnMode: "add" | "replace", conflictMode: "copy" | "overwrite") {
    if ((columnMode === "replace" || conflictMode === "overwrite") && data.columns.length && this.db.prepare("SELECT id FROM runs WHERE runs.workspaceId = workspace_id() AND taskId IN (SELECT id FROM tasks WHERE boardId = board_id()) AND status IN ('Queued', 'Running') LIMIT 1").get())
      throw new ConfigurationValidationError("Wait for queued and active runs to finish before replacing or overwriting columns.");
    if (columnMode === "replace" && data.columns.length) {
      this.db.exec("DELETE FROM column_assignments WHERE workspaceId = workspace_id() AND boardId = board_id(); DELETE FROM board_columns WHERE workspaceId = workspace_id() AND boardId = board_id();");
    }
    if (conflictMode === "overwrite") {
      for (const agent of data.agents) this.assertOwnership("agents", agent.id);
      for (const column of data.columns) {
        this.assertOwnership("board_columns", column.id);
        const existing = this.db.prepare("SELECT boardId FROM board_columns WHERE id = ?").get(column.id);
        if (existing && existing.boardId !== this.boardId) throw new ColumnValidationError("This column belongs to another board. Import a copy instead.");
      }
    }
    const agentIds = new Map<string, string>();
    for (const agent of data.agents) {
      const id = conflictMode === "overwrite" ? agent.id : randomUUID();
      this.saveAgent({ ...agent, id });
      agentIds.set(agent.id, id);
    }
    if (data.columns.some((column) => column.completion)) this.db.prepare("UPDATE board_columns SET completion = 0 WHERE workspaceId = workspace_id() AND boardId = board_id()").run();
    const columnNames = new Map<string, string>();
    const existing = this.listColumns();
    for (const column of data.columns) {
      const previous = conflictMode === "overwrite" ? this.db.prepare("SELECT name FROM board_columns WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() AND id = ?").get(column.id)?.name as string | undefined : undefined;
      let name = column.name;
      let suffix = 2;
      while (existing.some((item) => item !== previous && item.toLowerCase() === name.toLowerCase())) {
        const ending = ` (imported ${suffix++})`;
        name = column.name.slice(0, 80 - ending.length) + ending;
      }
      if (previous !== undefined) {
        this.db.prepare("DELETE FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column_assignments.boardId = board_id() AND column = ?").run(previous);
        this.db.prepare("UPDATE board_columns SET name = ? WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() AND id = ?").run(name, column.id);
        this.db.prepare("UPDATE tasks SET status = ? WHERE tasks.workspaceId = workspace_id() AND tasks.boardId = board_id() AND status = ?").run(name, previous);
        existing[existing.indexOf(previous)] = name;
      } else {
        this.db.prepare("INSERT INTO board_columns (workspaceId, boardId, id, name, position) VALUES (workspace_id(), board_id(), ?, ?, ?)").run(conflictMode === "overwrite" ? column.id : randomUUID(), name, existing.length);
        existing.push(name);
      }
      this.db.prepare("UPDATE board_columns SET instructions = ? WHERE workspaceId = workspace_id() AND boardId = board_id() AND name = ?").run(column.instructions ?? "", name);
      if (column.completion !== undefined) this.db.prepare("UPDATE board_columns SET completion = ? WHERE workspaceId = workspace_id() AND boardId = board_id() AND name = ?").run(Number(column.completion), name);
      columnNames.set(column.id, name);
    }
    for (const assignment of data.assignments) {
      this.assignColumnAgent({ column: columnNames.get(assignment.columnId)!, agentId: agentIds.get(assignment.agentId)! });
    }
    if (columnMode === "replace" && data.columns.length) {
      this.db.prepare("UPDATE comments SET feedbackStatus = 'cancelled' WHERE comments.workspaceId = workspace_id() AND taskId IN (SELECT id FROM tasks WHERE boardId = board_id()) AND feedbackStatus = 'pending'").run();
      this.db.prepare("UPDATE tasks SET status = ?, agentStatus = 'Not started' WHERE tasks.workspaceId = workspace_id() AND tasks.boardId = board_id()").run(columnNames.get(data.columns[0].id)!);
    }
    const memory = data.memory?.entries.length ? importMemory(this.db, this.workspaceId, this.boardId, data.memory) : 0;
    return { agents: data.agents.length, columns: data.columns.length, assignments: data.assignments.length, memory };
  }

  listColumns(boardId = this.boardId): string[] {
    return this.db
      .prepare("SELECT name FROM board_columns WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = ? ORDER BY position")
      .all(boardId)
      .map((row) => row.name as string);
  }

  columnInstructions(boardId = this.boardId): Record<string, string> {
    return Object.fromEntries(this.db.prepare("SELECT name, instructions FROM board_columns WHERE workspaceId = workspace_id() AND boardId = ?").all(boardId).map((row) => [row.name as string, row.instructions as string]));
  }

  completionColumn(boardId = this.boardId): string | null {
    return this.db.prepare("SELECT name FROM board_columns WHERE workspaceId = workspace_id() AND boardId = ? AND completion = 1").get(boardId)?.name as string | undefined ?? null;
  }

  searchMemory(query = "", offset = 0, limit = 20, includeRetired = false) { return searchMemoryEntries(this.db, this.workspaceId, query, offset, limit, includeRetired); }
  readMemoryEntries(ids: string[]) { return readMemoryEntries(this.db, this.workspaceId, ids); }
  memoryContext(query: string) { return memoryContext(this.db, this.workspaceId, query); }

  memoryHistory(id: string) { return memoryHistory(this.db, this.workspaceId, id); }
  changeMemory(input: unknown) {
    return this.transaction(() => {
      const changes = prepareMemoryChanges(this.db, this.workspaceId, [input]);
      applyMemoryChanges(this.db, this.workspaceId, changes);
      const revision = readMemory(this.db, this.workspaceId).revision + 1;
      this.db.prepare("INSERT INTO workspace_memory (workspaceId, revision, document, sourceTaskId, createdAt) VALUES (?, ?, ?, '', ?)")
        .run(this.workspaceId, revision, memoryDocument(this.db, this.workspaceId), new Date().toISOString());
      return { changed: true };
    });
  }
  memoryEvidence(id: string) {
    const item = this.readMemoryEntries([id])[0];
    const ids = [...item.source.matchAll(/#task\/([^\s)]+)/g)].map((match) => match[1]);
    return ids.map((taskId) => this.readTask(taskId)).filter((task) => task !== undefined);
  }

  workspaceMemory() { return readMemory(this.db, this.workspaceId); }

  memorySnapshot() { return this.transaction(() => readMemorySnapshot(this.db, this.workspaceId)); }

  clearMemory() {
    return this.transaction(() => {
      const affected = this.db.prepare("SELECT DISTINCT taskId FROM runs WHERE workspaceId = workspace_id() AND kind = 'memory' AND status IN ('Queued', 'Running', 'Waiting')").all();
      const now = new Date().toISOString();
      this.db.prepare(`UPDATE comments SET feedbackStatus = 'cancelled' WHERE workspaceId = workspace_id()
        AND responseType = 'memory' AND feedbackStatus = 'pending'`).run();
      this.db.prepare("UPDATE runs SET stopRequested = ? WHERE workspaceId = workspace_id() AND kind = 'memory' AND status = 'Running'").run(now);
      this.db.prepare(`UPDATE runs SET status = 'Stopped', finishedAt = ?, summary = 'Memory review cancelled because workspace memory was cleared.'
        WHERE workspaceId = workspace_id() AND kind = 'memory' AND status IN ('Queued', 'Waiting')`).run(now);
      const cleared = Number(this.db.prepare("SELECT COUNT(*) AS count FROM memory_entries WHERE workspaceId = workspace_id() AND removed = 0").get()!.count);
      this.db.prepare("DELETE FROM memory_versions WHERE workspaceId = workspace_id()").run();
      this.db.prepare("DELETE FROM memory_entries WHERE workspaceId = workspace_id()").run();
      this.db.prepare("DELETE FROM workspace_memory WHERE workspaceId = workspace_id()").run();
      // Keep the migration marker so old document data cannot be imported again.
      this.db.prepare("INSERT OR IGNORE INTO memory_entry_migrations(workspaceId) VALUES (workspace_id())").run();
      for (const { taskId } of affected) {
        this.db.prepare(`UPDATE tasks SET agentStatus = CASE
          WHEN EXISTS (SELECT 1 FROM runs WHERE taskId = tasks.id AND status = 'Running') THEN 'Running'
          WHEN EXISTS (SELECT 1 FROM comments WHERE taskId = tasks.id AND feedbackStatus = 'pending') THEN 'Waiting'
          WHEN EXISTS (SELECT 1 FROM runs WHERE taskId = tasks.id AND status = 'Queued') THEN 'Queued'
          ELSE 'Complete' END WHERE workspaceId = workspace_id() AND id = ?`).run(taskId);
      }
      return { cleared };
    });
  }

  private queueMemoryReview(taskId: string, column: string) {
    this.db.prepare(`INSERT INTO runs (workspaceId, workspacePath, id, taskId, column, profile, status, createdAt, kind)
      VALUES (workspace_id(), (SELECT path FROM workspaces WHERE id = workspace_id()), ?, ?, ?, ?, 'Queued', ?, 'memory')`)
      .run(randomUUID(), taskId, column, JSON.stringify(memoryProfile(this.getDefaultExecutor())), new Date().toISOString());
    this.db.prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE workspaceId = workspace_id() AND id = ?").run(taskId);
  }

  private columnName(input: unknown, current?: string): string {
    if (
      typeof input !== "string" ||
      !input.trim() ||
      input.trim().length > 80
    ) {
      throw new ColumnValidationError(
        "Enter a column name between 1 and 80 characters.",
      );
    }
    const name = input.trim();
    if (
      this.listColumns().some(
        (column) =>
          column !== current && column.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new ColumnValidationError(
        "A column with that name already exists.",
      );
    }
    return name;
  }

  createColumn(input: unknown): string[] {
    return this.transaction(() => {
      const name = this.columnName(input);
      this.db
        .prepare("INSERT INTO board_columns (workspaceId, boardId, id, name, position) VALUES (workspace_id(), board_id(), ?, ?, ?)")
        .run(randomUUID(), name, this.listColumns().length);
      return this.listColumns();
    });
  }

  renameColumn(column: unknown, input: unknown, instructions?: unknown, completion?: unknown): string[] {
    if (completion !== undefined && typeof completion !== "boolean") throw new ColumnValidationError("Choose whether this is the completion column.");
    if (instructions !== undefined && (typeof instructions !== "string" || instructions.length > 20000))
      throw new ColumnValidationError("Column instructions must contain no more than 20,000 characters.");
    return this.transaction(() => {
      if (typeof column !== "string" || !this.listColumns().includes(column)) {
        throw new ColumnValidationError(
          "Choose an existing column. Reload settings and try again.",
        );
      }
      const name = this.columnName(input, column);
      if (completion !== undefined) {
        if (completion) this.db.prepare("UPDATE board_columns SET completion = 0 WHERE workspaceId = workspace_id() AND boardId = board_id()").run();
        this.db.prepare("UPDATE board_columns SET completion = ? WHERE workspaceId = workspace_id() AND boardId = board_id() AND name = ?").run(Number(completion), column);
      }
      if (instructions !== undefined)
        this.db.prepare("UPDATE board_columns SET instructions = ? WHERE workspaceId = workspace_id() AND boardId = board_id() AND name = ?").run(instructions as string, column);
      this.db
        .prepare("UPDATE board_columns SET name = ? WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() AND name = ?")
        .run(name, column);
      this.db
        .prepare("UPDATE tasks SET status = ? WHERE tasks.workspaceId = workspace_id() AND tasks.boardId = board_id() AND status = ?")
        .run(name, column);
      this.db
        .prepare("UPDATE column_assignments SET column = ? WHERE column_assignments.workspaceId = workspace_id() AND column_assignments.boardId = board_id() AND column = ?")
        .run(name, column);
      this.db
        .prepare(
          "UPDATE runs SET column = ? WHERE runs.workspaceId = workspace_id() AND taskId IN (SELECT id FROM tasks WHERE boardId = board_id()) AND column = ? AND status IN ('Queued', 'Running', 'Waiting')",
        )
        .run(name, column);
      this.db
        .prepare(
          "UPDATE runs SET interruptionColumn = ? WHERE runs.workspaceId = workspace_id() AND taskId IN (SELECT id FROM tasks WHERE boardId = board_id()) AND interruptionColumn = ? AND status = 'Running'",
        )
        .run(name, column);
      return this.listColumns();
    });
  }

  deleteColumn(column: unknown): string[] {
    return this.transaction(() => {
      const columns = this.listColumns();
      if (typeof column !== "string" || !columns.includes(column)) {
        throw new ColumnValidationError(
          "Choose an existing column. Reload settings and try again.",
        );
      }
      if (columns.length === 1)
        throw new ColumnValidationError("Keep at least one board column.");
      if (
        this.db
          .prepare("SELECT id FROM tasks WHERE tasks.workspaceId = workspace_id() AND tasks.boardId = board_id() AND archivedAt IS NULL AND status = ? LIMIT 1")
          .get(column)
      ) {
        throw new ColumnValidationError(
          "Move all tasks to another column before deleting this column.",
        );
      }
      this.db
        .prepare("DELETE FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column_assignments.boardId = board_id() AND column = ?")
        .run(column);
      this.db.prepare("DELETE FROM board_columns WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() AND name = ?").run(column);
      for (const [position, name] of this.listColumns().entries()) {
        this.db
          .prepare("UPDATE board_columns SET position = ? WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() AND name = ?")
          .run(position, name);
      }
      return this.listColumns();
    });
  }

  reorderColumns(input: unknown): string[] {
    return this.transaction(() => {
      const columns = this.listColumns();
      if (
        !Array.isArray(input) ||
        input.length !== columns.length ||
        new Set(input).size !== columns.length ||
        !input.every(
          (name) => typeof name === "string" && columns.includes(name),
        )
      ) {
        throw new ColumnValidationError(
          "Include every existing column exactly once. Reload settings and try again.",
        );
      }
      for (const [position, name] of input.entries()) {
        this.db
          .prepare("UPDATE board_columns SET position = ? WHERE board_columns.workspaceId = workspace_id() AND board_columns.boardId = board_id() AND name = ?")
          .run(position, name);
      }
      return this.listColumns();
    });
  }

  readTask(id: string): Task | undefined {
    this.assertOwnership("tasks", id);
    return this.list(true, id)[0];
  }

  list(includeArchived = false, taskId?: string): Task[] {
    const credits = this.usage().taskCredits();
    return (
      this.db
        .prepare("SELECT tasks.*, task_numbers.number AS taskNumber FROM tasks JOIN task_numbers ON task_numbers.taskId = tasks.id WHERE tasks.workspaceId = workspace_id() AND (? OR tasks.archivedAt IS NULL) AND (? IS NULL OR tasks.id = ?) ORDER BY tasks.rowid")
        .all(includeArchived ? 1 : 0, taskId ?? null, taskId ?? null) as unknown as Task[]
    ).map((task) => ({
      ...task,
      worktree: typeof task.worktree === "string" ? JSON.parse(task.worktree) : null,
      creditUsage: credits.get(task.id) ?? { credits: 0, calls: 0, priced: 0, pending: 0 },
      autoWorkflow: Boolean(task.autoWorkflow),
      autoRun: Boolean(task.autoRun),
      comments: this.db
        .prepare(
          `SELECT comments.* FROM comments WHERE comments.workspaceId = workspace_id() AND taskId = ? AND NOT EXISTS (
            SELECT 1 FROM runs WHERE runs.workspaceId = workspace_id() AND runs.kind = 'intent' AND runs.taskId = comments.taskId
              AND (runs.id = comments.runId OR (
                runs.finishedAt = comments.createdAt AND runs.summary = comments.body
                AND json_extract(runs.profile, '$.name') = comments.authorName
              ))
          ) ORDER BY createdAt, rowid`,
        )
        .all(task.id).map((row) => {
          const artifacts = this.db.prepare("SELECT artifactId FROM comment_artifacts WHERE commentId = ? ORDER BY artifactId").all(row.id).map((ref) => ({ ...ref }));
          const changes = row.runId
            ? this.db.prepare("SELECT changes FROM memory_reviews WHERE runId = ?").get(row.runId)?.changes : null;
          return { ...row, ...(changes ? { memoryChanges: JSON.parse(String(changes)) } : {}), ...(artifacts.length ? { artifacts } : {}) } as TaskComment;
        }),
    }));
  }

  private recordWorktree(taskId: string, record: TaskWorktree) {
    this.db.prepare("UPDATE tasks SET worktree = ? WHERE id = ? AND workspaceId = workspace_id()")
      .run(JSON.stringify(record), taskId);
  }

  taskWorkspace(taskId: string, workspace: string, onActivity?: (activity: RunActivityUpdate) => void): string {
    const task = this.readTask(taskId);
    if (!task) throw new Error("This task no longer exists.");
    if (task.status === this.completionColumn(task.boardId))
      throw new Error("Reopen the task before running an agent with code access.");
    if (!this.getWorktreesEnabled()) return workspace;
    const record = task.worktree ?? planWorktree(workspace, task, `${this.databasePath}:${this.workspaceId}:${task.id}`);
    if (!record) return workspace;
    if (realpathSync(workspace) !== realpathSync(resolve(record.repository, record.subdirectory)))
      throw new Error("The workspace directory changed. Restore the original workspace directory before continuing this task.");
    // Persist ownership before Git changes the filesystem, so restart can recover creation.
    this.recordWorktree(task.id, record);
    const activity = { id: "setup:worktree", title: existsSync(record.path) ? "Preparing the task worktree" : "Creating a worktree" };
    onActivity?.({ ...activity, status: "running" });
    try {
      const path = openWorktree(record);
      this.recordWorktree(task.id, { ...record, headCommit: worktreeHead(record), status: "active", error: undefined });
      onActivity?.({ ...activity, status: "complete" });
      return path;
    } catch (error) {
      onActivity?.({ ...activity, status: "error" });
      this.recordWorktree(task.id, { ...record, status: "error", error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  cleanupWorktrees(retryTaskId?: string) {
    if (!this.getWorktreesEnabled()) return;
    for (const candidate of this.list(true)) {
      if (retryTaskId && candidate.id !== retryTaskId) continue;
      if (!candidate.worktree || candidate.worktree.status === "removed") continue;
      // Keep task moves and run claims out of the cleanup window across app processes.
      this.transaction(() => {
        const task = this.readTask(candidate.id);
        if (!task?.worktree || task.worktree.status === "removed" || (task.worktree.status === "error" && !retryTaskId)) return;
        if (task.archivedAt || task.status !== this.completionColumn(task.boardId)) return;
        if (this.history(task.id).some((run) => run.status === "Running")) return;
        if (this.db.prepare("SELECT id FROM chat_sessions WHERE workspaceId = workspace_id() AND taskId = ? AND lease > ?")
          .get(task.id, new Date().toISOString())) return;
        try { this.recordWorktree(task.id, closeWorktree(task.worktree, task)); }
        catch (error) {
          this.recordWorktree(task.id, { ...task.worktree, status: "error", error: error instanceof Error ? error.message : String(error) });
        }
      });
    }
  }

  save(input: unknown): Task {
    if (!input || typeof input !== "object") throw new Error("Invalid task.");
    this.assertInputOwnership(input);
    const task = input as Task;
    if (this.readTask(task.id)?.archivedAt) throw new Error("Archived tasks cannot be edited.");
    const existing = this.list().find((item) => item.id === task.id);
    const branchName = existing?.branchName ?? (existing ? null : validateBranchName(task.branchName));
    const boardId = task.boardId ?? existing?.boardId ?? this.boardId;
    this.requireBoard(boardId);
    if (
      typeof task.id !== "string" ||
      !task.id.trim() ||
      typeof task.title !== "string" ||
      !task.title.trim() ||
      typeof task.description !== "string" ||
      !this.listColumns(boardId).includes(task.status) ||
      (task.autoWorkflow !== undefined &&
        typeof task.autoWorkflow !== "boolean") ||
      (task.autoRun !== undefined && typeof task.autoRun !== "boolean")
    ) {
      throw new Error("Enter a title and valid task properties.");
    }
    this.transaction(() => {
      this.assertOwnership("tasks", task.id);
      const previous = this.list().find((item) => item.id === task.id);
      const movedBoard = previous && previous.boardId !== boardId;
      if (movedBoard) this.assertIdle(task.id, "moving the task to another board");
      if (previous && (previous.status !== task.status || movedBoard)) {
        this.db.prepare("UPDATE comments SET feedbackStatus = 'cancelled' WHERE comments.workspaceId = workspace_id() AND taskId = ? AND feedbackStatus = 'pending'").run(task.id);
        this.db
          .prepare(
            `UPDATE runs SET status = 'Interrupted', finishedAt = ?, summary = ?
          WHERE runs.workspaceId = workspace_id() AND taskId = ? AND status = 'Queued' AND ? <> 'Stopped'`,
          )
          .run(
            new Date().toISOString(),
            `Queued run cancelled because the task moved to ${task.status}.`,
            task.id,
            previous.agentStatus,
          );
        this.db
          .prepare(
            "UPDATE runs SET interruptionColumn = ? WHERE runs.workspaceId = workspace_id() AND taskId = ? AND status = 'Running'",
          )
          .run(task.status, task.id);
        this.db
          .prepare(
            `UPDATE tasks SET agentStatus = CASE
          WHEN agentStatus = 'Stopped' THEN 'Stopped'
          WHEN EXISTS (SELECT 1 FROM runs WHERE runs.workspaceId = workspace_id() AND taskId = ? AND status = 'Running') THEN 'Running'
          WHEN agentStatus IN ('Complete', 'Failed', 'Interrupted') THEN agentStatus
          ELSE 'Not started' END WHERE tasks.workspaceId = workspace_id() AND id = ?`,
          )
          .run(task.id, task.id);
      }
      this.db
        .prepare(
          `INSERT INTO tasks (workspaceId, boardId, id, title, description, status, autoWorkflow, autoRun, branchName) VALUES (workspace_id(), ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
        boardId=excluded.boardId, status=excluded.status, autoWorkflow=excluded.autoWorkflow, autoRun=excluded.autoRun
        WHERE tasks.workspaceId = excluded.workspaceId`,
        )
        .run(
          boardId,
          task.id,
          task.title.trim(),
          task.description,
          task.status,
          Number(task.autoWorkflow ?? previous?.autoWorkflow ?? false),
          Number(task.autoRun ?? previous?.autoRun ?? false),
          branchName,
        );
      // Description references become task attachments in the same transaction,
      // including artifacts created while composing a task that has no ID yet.
      for (const ref of artifactMentions(task.description)) {
        if (!this.db.prepare("SELECT id FROM artifacts WHERE id = ? AND workspaceId = workspace_id()")
          .get(ref.artifactId)) {
          throw new Error("Choose a valid artifact reference.");
        }
        this.db.prepare("INSERT OR IGNORE INTO task_artifacts (taskId, artifactId) VALUES (?, ?)").run(task.id, ref.artifactId);
      }
      if ((!previous || previous.status !== task.status || movedBoard) && task.status === this.completionColumn(boardId)) {
        this.queueMemoryReview(task.id, task.status);
      } else if (previous?.agentStatus !== "Stopped" && (!previous || previous.status !== task.status || movedBoard) && (task.autoRun ?? previous?.autoRun ?? false)) {
        this.queueAgent(task.id, task.status);
      }
      return this.list().find((item) => item.id === task.id)!;
    });
    this.cleanupWorktrees(task.id);
    return this.readTask(task.id)!;
  }

  runTask(taskId: unknown): Task {
    if (typeof taskId !== "string") throw new RunValidationError("Choose a task to run.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      if (!task) throw new RunValidationError("This task no longer exists.");
      if (this.history(taskId).some((run) => (run.status === "Queued" && task.agentStatus !== "Stopped") || run.status === "Running"))
        throw new RunValidationError("This task already has a queued or running agent.");
      if (task.comments?.some((comment) => comment.feedbackStatus === "pending"))
        throw new RunValidationError("Answer the pending feedback before starting another run.");
      if (task.status === this.completionColumn(task.boardId)) {
        this.queueMemoryReview(task.id, task.status);
        return this.list().find((item) => item.id === taskId)!;
      }
      if (!this.listColumnAgents(task.boardId).some((assignment) => assignment.column === task.status))
        throw new RunValidationError("Assign an agent to this column before running the task.");
      this.queueAgent(task.id, task.status);
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  stopTask(taskId: unknown): Task {
    if (typeof taskId !== "string") throw new RunValidationError("Choose a task to stop.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      if (!task) throw new RunValidationError("This task no longer exists.");
      if (!this.history(taskId).some((run) => run.status === "Queued" || run.status === "Running"))
        throw new RunValidationError("This task no longer has a queued or running agent.");
      const now = new Date().toISOString();
      this.db.prepare(`UPDATE runs SET status = 'Stopped', finishedAt = ?, summary = 'Queued run cancelled by the user.'
        WHERE workspaceId = workspace_id() AND taskId = ? AND status = 'Queued'`).run(now, taskId);
      this.db.prepare(`UPDATE runs SET stopRequested = ?
        WHERE workspaceId = workspace_id() AND taskId = ? AND status = 'Running'`).run(now, taskId);
      this.db.prepare("UPDATE tasks SET agentStatus = 'Stopped' WHERE workspaceId = workspace_id() AND id = ?").run(taskId);
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  private queueAgent(taskId: string, column: string) {
    this.assertWorkspaceActive();
    const assignment = this.listColumnAgents(this.db.prepare("SELECT boardId FROM tasks WHERE id = ? AND workspaceId = workspace_id()").get(taskId)?.boardId as string | undefined).find(
      (item) => item.column === column,
    );
    const profile = this.listAgents().find(
      (item) => item.id === assignment?.agentId,
    );
    if (profile) {
      this.db
        .prepare(
          `INSERT INTO runs (workspaceId, workspacePath, id, taskId, column, profile, status, createdAt)
        VALUES (workspace_id(), (SELECT path FROM workspaces WHERE id = workspace_id()), ?, ?, ?, ?, 'Queued', ?)`,
        )
        .run(
          randomUUID(),
          taskId,
          column,
          JSON.stringify(profile),
          new Date().toISOString(),
        );
      this.db
        .prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE tasks.workspaceId = workspace_id() AND id = ?")
        .run(taskId);
    }
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  usage() { return new UsageStore(this.db, this.workspaceId); }

  history(taskId?: string): AgentRun[] {
    if (taskId !== undefined) this.assertOwnership("tasks", taskId);
    const rows =
      taskId === undefined
        ? this.db.prepare("SELECT * FROM runs WHERE runs.workspaceId = workspace_id() ORDER BY rowid").all()
        : this.db
            .prepare("SELECT * FROM runs WHERE runs.workspaceId = workspace_id() AND taskId = ? ORDER BY rowid")
            .all(taskId);
    return rows.map((row) => ({
      ...row,
      profile: JSON.parse(row.profile as string),
      replyPlan: row.replyPlan ? JSON.parse(row.replyPlan as string) : null,
    })) as AgentRun[];
  }

  recordActivity(runId: string, activity: RunActivityUpdate) {
    this.assertOwnership("runs", runId);
    const run = this.db.prepare("SELECT status FROM runs WHERE id = ?").get(runId);
    if (run?.status !== "Running") return;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO run_activity (runId, id, title, status, detail, createdAt, updatedAt, toolName, filePath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(runId, id) DO UPDATE SET
      title = excluded.title, status = excluded.status,
      detail = COALESCE(excluded.detail, run_activity.detail), updatedAt = excluded.updatedAt,
      toolName = COALESCE(excluded.toolName, run_activity.toolName), filePath = COALESCE(excluded.filePath, run_activity.filePath)`)
      .run(runId, activity.id, activity.title.slice(0, 500), activity.status, activity.detail?.slice(0, 16000) ?? null, now, now, activity.toolName?.slice(0, 200) ?? null, activity.filePath?.slice(0, 1000) ?? null);
  }

  runActivity(runId: string): RunActivity[] {
    this.assertOwnership("runs", runId);
    return this.db.prepare("SELECT id, title, status, detail, toolName, filePath, createdAt, updatedAt FROM run_activity WHERE runId = ? ORDER BY rowid")
      .all(runId).map(row => ({ ...row, detail: row.detail ?? undefined, toolName: row.toolName ?? undefined, filePath: row.filePath ?? undefined })) as RunActivity[];
  }

  executionState(): ExecutionState {
    const active = this.db.prepare(`SELECT runs.id AS runId, tasks.id AS taskId, tasks.title AS taskTitle,
      json_extract(runs.profile, '$.name') AS agentName, workspaces.id AS workspaceId,
      workspaces.name AS workspaceName, runs.workspacePath, runs.stopRequested
      FROM runs JOIN tasks ON tasks.id = runs.taskId JOIN workspaces ON workspaces.id = runs.workspaceId
      WHERE runs.status = 'Running' LIMIT 1`).get();
    return {
      queued: this.db.prepare(`SELECT runs.id AS runId, tasks.title AS taskTitle,
        json_extract(runs.profile, '$.name') AS agentName, workspaces.name AS workspaceName,
        (tasks.agentStatus = 'Stopped' OR EXISTS (SELECT 1 FROM comments
          WHERE comments.taskId = tasks.id AND comments.feedbackStatus = 'pending')) AS held
        FROM runs JOIN tasks ON tasks.id = runs.taskId JOIN workspaces ON workspaces.id = runs.workspaceId
        WHERE runs.status = 'Queued' ORDER BY runs.createdAt, runs.rowid`).all()
        .map((row) => ({ ...row, held: Boolean(row.held) })) as import("../domain/execution.ts").QueuedRun[],
      directoryChanges: this.queuedDirectoryChanges(),
      paused: Boolean(this.db.prepare("SELECT paused FROM execution_control WHERE id = 1").get()?.paused),
      active: active ? { ...active, stopping: Boolean(active.stopRequested) } as ExecutionState["active"] : null,
    };
  }

  stopExecution(runId: string) {
    return this.transaction(() => {
      const active = this.db.prepare("SELECT * FROM runs WHERE status = 'Running'").get();
      if (active && active.id !== runId) throw new RunValidationError("The active run changed. Refresh and try again.");
      this.db.prepare("UPDATE execution_control SET paused = 1 WHERE id = 1").run();
      if (!active) return;
      this.db.prepare("UPDATE runs SET stopRequested = ? WHERE id = ?").run(new Date().toISOString(), runId);
      this.db.prepare("UPDATE tasks SET agentStatus = 'Stopped' WHERE id = ?").run(active.taskId);
    });
  }

  private queuedDirectoryChanges() {
    return this.db.prepare(`SELECT runs.id AS runId, workspaces.name AS workspaceName,
      runs.workspacePath AS previousPath, workspaces.path
      FROM runs JOIN workspaces ON workspaces.id = runs.workspaceId
      WHERE runs.status = 'Queued' AND runs.workspacePath <> workspaces.path ORDER BY runs.id`).all() as
      import("../domain/execution.ts").QueuedDirectoryChange[];
  }

  pauseExecution() {
    this.db.prepare("UPDATE execution_control SET paused = 1 WHERE id = 1").run();
  }

  resumeExecution(confirmedChanges?: unknown) {
    return this.transaction(() => {
      const changes = this.queuedDirectoryChanges();
      if (changes.length && JSON.stringify(confirmedChanges) !== JSON.stringify(changes))
        throw new RunValidationError("Confirm the current directory changes before resuming the queue.");
      for (const change of changes)
        this.db.prepare("UPDATE runs SET workspacePath = ? WHERE id = ?").run(change.path, change.runId);
      this.db.prepare("UPDATE execution_control SET paused = 0 WHERE id = 1").run();
    });
  }

  claimRun(): AgentRun | undefined {
    return this.transaction(() => {
      if (!this.listWorkspaces().some((workspace) => workspace.id === this.workspaceId)) return;
      if (this.executionState().paused) return;
      if (this.queuedDirectoryChanges().length) {
        this.pauseExecution();
        return;
      }
      if (this.db.prepare("SELECT id FROM runs WHERE status = 'Running'").get())
        return;
      const waiting = new Set(this.list().filter((task) => task.agentStatus === "Stopped" || task.comments?.some((comment) => comment.feedbackStatus === "pending")).map((task) => task.id));
      const run = this.history().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((run) => run.status === "Queued" && !waiting.has(run.taskId));
      if (!run) return;
      if (this.db.prepare("SELECT id FROM chat_sessions WHERE taskId = ? AND lease > ?").get(run.taskId, new Date().toISOString())) return;
      const taskBoard = this.db.prepare("SELECT boardId FROM tasks WHERE workspaceId = workspace_id() AND id = ?").get(run.taskId)!.boardId as string;
      const columnInstructions = run.kind === "intent" || run.kind === "memory" ? "" : this.columnInstructions(taskBoard)[run.column] ?? "";
      this.db.prepare("UPDATE runs SET columnInstructions = ? WHERE id = ? AND workspaceId = workspace_id()").run(columnInstructions, run.id);
      if (run.kind === "memory") this.db.prepare("INSERT OR REPLACE INTO memory_reviews (runId, baseRevision, baseDocument) VALUES (?, ?, ?)").run(run.id, this.workspaceMemory().revision, this.workspaceMemory().document);
      const startedAt = new Date().toISOString();
      const ownerIdentity = processIdentity(process.pid);
      if (!ownerIdentity)
        throw new Error("Could not identify the app process.");
      this.db
        .prepare(
          "UPDATE runs SET status = 'Running', startedAt = ?, ownerPid = ?, ownerIdentity = ? WHERE runs.workspaceId = workspace_id() AND id = ?",
        )
        .run(startedAt, process.pid, ownerIdentity, run.id);
      this.db
        .prepare("UPDATE tasks SET agentStatus = 'Running' WHERE tasks.workspaceId = workspace_id() AND id = ?")
        .run(run.taskId);
      return {
        ...run,
        status: "Running",
        columnInstructions,
        startedAt,
        ownerPid: process.pid,
        ownerIdentity,
      };
    });
  }

  interruptionRequested(runId: string): boolean {
    this.assertOwnership("runs", runId);
    return Boolean(
      this.db
        .prepare("SELECT COALESCE(stopRequested, interruptionColumn) AS interruptionColumn FROM runs WHERE runs.workspaceId = workspace_id() AND id = ?")
        .get(runId)?.interruptionColumn,
    );
  }

  recordRunner(runId: string, pid: number) {
    this.assertOwnership("runs", runId);
    this.db
      .prepare(
        "UPDATE runs SET runnerPid = ?, runnerIdentity = ? WHERE runs.workspaceId = workspace_id() AND id = ? AND status = 'Running'",
      )
      .run(pid, processIdentity(pid), runId);
  }

  finishRun(
    runId: string,
    status: "Complete" | "Failed" | "Interrupted" | "Stopped" | "Waiting",
    summary: string,
    recommendation?: string,
    replyPlan?: AgentProfile[],
    artifacts: ArtifactReference[] = [],
    responseType?: "text" | "approval" | "memory",
  ) {
    this.assertOwnership("runs", runId);
    this.transaction(() => {
      const run = this.history().find(
        (run) => run.id === runId && run.status === "Running",
      );
      if (!run) return;
      if (run.interruptionColumn) {
        status = "Interrupted";
        summary = `Agent run interrupted because the task moved to ${run.interruptionColumn}. Workspace changes were preserved.`;
      }
      if (run.stopRequested) {
        status = "Stopped";
        summary = "Agent run stopped by the user. Saved work and history were preserved. Run this task again to request a new run.";
      }
      if (run.kind === "memory" && status === "Complete") {
        const output = JSON.parse(summary.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
        if (!output || typeof output !== "object" || !("changes" in output))
          throw new Error("Memory review must return entry changes.");
        const changes = prepareMemoryChanges(this.db, this.workspaceId, output.changes);
        if (changes.length) {
          applyMemoryChanges(this.db, this.workspaceId, changes);
          this.db.prepare("UPDATE memory_reviews SET changes = ? WHERE runId = ?").run(JSON.stringify(changes), runId);
          this.db.prepare("INSERT INTO workspace_memory (workspaceId, revision, document, sourceTaskId, createdAt) VALUES (workspace_id(), ?, ?, ?, ?)")
            .run(this.workspaceMemory().revision + 1, memoryDocument(this.db, this.workspaceId), run.taskId, new Date().toISOString());
          summary = `Workspace memory updated: ${memoryChangesSummary(changes)}.`;
        } else summary = "No memory changes recorded.";
      }
      if (status === "Waiting" && (!summary.trim() || !recommendation?.trim()))
        throw new FeedbackValidationError("Feedback requests require a question and recommendation.");
      const finishedAt = new Date().toISOString();
      this.db.prepare("UPDATE run_activity SET status = 'interrupted', updatedAt = ? WHERE runId = ? AND status = 'running'")
        .run(finishedAt, runId);
      this.db
        .prepare(
          "UPDATE runs SET status = ?, finishedAt = ?, summary = ? WHERE runs.workspaceId = workspace_id() AND id = ?",
        )
        .run(status, finishedAt, summary, runId);
      if (run.kind && run.kind !== "memory" && (status === "Complete" || (status === "Failed" && run.kind === "reply"))) {
        const remaining = replyPlan ?? run.replyPlan ?? [];
        const [next, ...rest] = remaining;
        if (next) this.queueCommentRun(run.taskId, run.column, next, "reply", run.commentId!, rest, run.createdAt);
      }
      this.db
        .prepare(
          `UPDATE tasks SET agentStatus = CASE
        WHEN ? = 'Stopped' THEN 'Stopped'
        WHEN EXISTS (SELECT 1 FROM comments WHERE comments.workspaceId = workspace_id() AND taskId = ? AND feedbackStatus = 'pending') OR ? = 'Waiting' THEN 'Waiting'
        WHEN EXISTS (SELECT 1 FROM runs WHERE runs.workspaceId = workspace_id() AND taskId = ? AND status = 'Queued') THEN 'Queued'
        ELSE ? END WHERE tasks.workspaceId = workspace_id() AND id = ?`,
        )
        .run(status, run.taskId, status, run.taskId, status, run.taskId);
      // A stop notice is execution history, not an agent handover or evidence of saved work.
      if (run.kind !== "intent" && status !== "Stopped") {
        const commentId = randomUUID();
        this.addComment({
          id: commentId,
          taskId: run.taskId,
          runId,
          parentCommentId: run.kind === "reply"
            ? status === "Waiting" ? run.commentId
              : this.list().find((task) => task.id === run.taskId)?.comments?.find((comment) => comment.id === run.commentId)?.parentCommentId
            : undefined,
          body: summary,
          createdAt: finishedAt,
          authorName: run.profile.name,
          authorRole: "agent",
          ...(status === "Waiting" ? { recommendation, responseType, feedbackStatus: "pending" } : {}),
        });
        if (status === "Complete" || status === "Waiting") this.attachCommentArtifacts(commentId, artifacts);
      }
      const task = this.list().find((task) => task.id === run.taskId);
      if (
        status === "Complete" &&
        !run.kind &&
        !this.history(run.taskId).some((item) => item.status === "Queued") &&
        task?.autoWorkflow &&
        task.status === run.column &&
        task.status !== this.completionColumn(task.boardId)
      ) {
        const columns = this.listColumns(task.boardId);
        const index = columns.indexOf(task.status);
        const nextColumn = index >= 0 ? columns[index + 1] : undefined;
        // Managed code changes wait for an explicit Human move to completion.
        if (nextColumn && !(this.getWorktreesEnabled() && task.worktree && nextColumn === this.completionColumn(task.boardId))) {
          this.db
            .prepare(
              "UPDATE tasks SET status = ? WHERE tasks.workspaceId = workspace_id() AND id = ?",
            )
            .run(nextColumn, task.id);
          if (nextColumn === this.completionColumn(task.boardId)) this.queueMemoryReview(task.id, nextColumn);
          else if (task.autoRun) this.queueAgent(task.id, nextColumn);
        }
      }
    });
  }

  answerFeedback(taskId: unknown, commentId: unknown, body: unknown): Task {
    this.assertWorkspaceActive();
    if (typeof taskId !== "string" || typeof commentId !== "string" ||
        typeof body !== "string" || !body.trim())
      throw new FeedbackValidationError("Enter a feedback reply.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      const request = task?.comments?.find((item) => item.id === commentId && item.feedbackStatus === "pending");
      const run = request && this.history(taskId).find((item) => item.id === request.runId);
      if (!task || task.agentStatus !== "Waiting" || !request || !run)
        throw new FeedbackValidationError("This feedback request is no longer pending. Reload the task.");
      if (request.responseType === "approval" && !["Approved", "Rejected"].includes(body.trim()))
        throw new FeedbackValidationError("Select Approve or Reject.");
      this.db.prepare("UPDATE comments SET feedbackStatus = 'answered' WHERE comments.workspaceId = workspace_id() AND id = ?").run(commentId);
      this.addComment({ id: randomUUID(), taskId, body: body.trim(), createdAt: new Date().toISOString(), authorName: this.getUserName() || "Human", authorRole: "human", runId: run.id, parentCommentId: request.id });
      this.db.prepare("INSERT INTO runs (workspaceId, workspacePath, id, taskId, column, profile, status, createdAt, kind, commentId, replyPlan) VALUES (workspace_id(), (SELECT path FROM workspaces WHERE id = workspace_id()), ?, ?, ?, ?, 'Queued', ?, ?, ?, ?)")
        .run(randomUUID(), taskId, task.status, JSON.stringify(run.profile), run.createdAt, run.kind ?? null, run.commentId ?? null, run.replyPlan ? JSON.stringify(run.replyPlan) : null);
      this.db.prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE tasks.workspaceId = workspace_id() AND id = ?").run(taskId);
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  deleteComment(taskId: unknown, commentId: unknown): Task {
    this.assertWorkspaceActive();
    if (typeof taskId !== "string" || typeof commentId !== "string")
      throw new CommentValidationError("Choose a comment to delete.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      const comment = task?.comments?.find((item) => item.id === commentId);
      if (!task || !comment) throw new CommentValidationError("This comment no longer exists.");
      if (task.agentStatus === "Running" || task.agentStatus === "Queued")
        throw new CommentValidationError("Stop the agent or wait for it to finish before deleting comments.");
      const deleting = conversationDeletion(task.comments ?? [], commentId);
      const ids = new Set(deleting.map((item) => item.id));
      if (this.history(taskId).some((run) => run.status === "Waiting" && run.commentId && ids.has(run.commentId) && task.comments?.some((item) => item.runId === run.id && item.feedbackStatus === "pending" && !ids.has(item.id))))
        throw new CommentValidationError("Answer or cancel this feedback request before deleting it.");
      removeConversationMessages(this.db, { kind: "comments", workspaceId: this.workspaceId, taskId }, task.comments ?? [], commentId);
      const pending = deleting.filter((item) => item.feedbackStatus === "pending");
      for (const request of pending) {
        this.db.prepare("UPDATE runs SET status = 'Stopped' WHERE workspaceId = workspace_id() AND taskId = ? AND id = ? AND status = 'Waiting'")
          .run(taskId, request.runId ?? null);
      }
      if (pending.length) {
        this.db.prepare(`UPDATE tasks SET agentStatus = 'Stopped'
          WHERE workspaceId = workspace_id() AND id = ? AND agentStatus = 'Waiting'
          AND NOT EXISTS (SELECT 1 FROM comments WHERE workspaceId = workspace_id() AND taskId = ? AND feedbackStatus = 'pending')`)
          .run(taskId, taskId);
      }
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  postComment(taskId: unknown, body: unknown, attachments: unknown = [], parentCommentId?: unknown): Task {
    this.assertWorkspaceActive();
    if (typeof taskId !== "string" || typeof body !== "string" || !body.trim())
      throw new CommentValidationError("Enter a comment.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      if (!task) throw new CommentValidationError("This task no longer exists.");
      const parent = parentCommentId === undefined ? undefined : task.comments?.find((item) => item.id === parentCommentId);
      if (parentCommentId !== undefined && (!parent || typeof parentCommentId !== "string"))
        throw new CommentValidationError("This message no longer exists. Reload the task.");
      const threadId = parent && groupActivity(task.comments ?? []).find(({ message, replies }) => message.id === parent.id || replies.some((reply) => reply.id === parent.id))?.message.id;
      const agents = this.listAgents();
      const ids = mentionedAgentIds(body, agents);
      const profiles = ids.map((id) => {
        const agent = agents.find((item) => item.id === id);
        if (!agent) throw new CommentValidationError("A tagged agent no longer exists. Remove the mention and try again.");
        return agent;
      });
      const commentId = randomUUID();
      this.addComment({ id: commentId, taskId, body: body.trim(), createdAt: new Date().toISOString(), authorName: this.getUserName() || "Human", authorRole: "human", parentCommentId: threadId });
      this.attachCommentArtifacts(commentId, attachments);
      if (profiles.length) {
        this.queueCommentRun(taskId, task.status, intentProfile(this.getDefaultExecutor()), "intent", commentId, profiles);
        if (task.agentStatus !== "Running" && task.agentStatus !== "Waiting")
          this.db.prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE tasks.workspaceId = workspace_id() AND id = ?").run(taskId);
      }
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  private attachCommentArtifacts(commentId: string, attachments: unknown) {
    if (!Array.isArray(attachments)) throw new CommentValidationError("Choose valid artifact attachments.");
    const comment = this.db.prepare("SELECT body FROM comments WHERE id = ? AND workspaceId = workspace_id()").get(commentId);
    const mentioned = new Set(artifactMentions(String(comment?.body ?? "")).map((ref) => ref.artifactId));
    for (const ref of attachments) {
      if (!ref || typeof ref.artifactId !== "string" ||
          !this.db.prepare("SELECT id FROM artifacts WHERE id = ? AND workspaceId = workspace_id()")
            .get(ref.artifactId))
        throw new CommentValidationError("Artifact not found in this workspace.");
      if (!mentioned.has(ref.artifactId)) continue;
      this.db.prepare("INSERT OR IGNORE INTO comment_artifacts (commentId, artifactId) VALUES (?, ?)")
        .run(commentId, ref.artifactId);
    }
  }

  private queueCommentRun(taskId: string, column: string, profile: AgentProfile, kind: "intent" | "reply", commentId: string, replyPlan: AgentProfile[], createdAt = new Date().toISOString()) {
    this.assertWorkspaceActive();
    this.db.prepare("INSERT INTO runs (workspaceId, workspacePath, id, taskId, column, profile, status, createdAt, kind, commentId, replyPlan) VALUES (workspace_id(), (SELECT path FROM workspaces WHERE id = workspace_id()), ?, ?, ?, ?, 'Queued', ?, ?, ?, ?)")
      .run(randomUUID(), taskId, column, JSON.stringify(profile), createdAt, kind, commentId, JSON.stringify(replyPlan));
  }

  private discardTaskWorktree(task: Task) {
    if (!task.worktree) return;
    try { discardWorktree(task.worktree); }
    catch (error) {
      throw new PendingRunError(`Could not clean up the task worktree and branch. ${error instanceof Error ? error.message : String(error)}`);
    }
    this.db.prepare("UPDATE tasks SET worktree = NULL WHERE workspaceId = workspace_id() AND id = ?").run(task.id);
  }

  reset(taskId: unknown): Task {
    this.assertWorkspaceActive();
    if (typeof taskId !== "string" || !taskId)
      throw new RunValidationError("Choose a task to reset.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      if (!task) throw new RunValidationError("This task no longer exists.");
      this.assertIdle(taskId, "resetting the task");
      if (this.db.prepare("SELECT id FROM chat_sessions WHERE workspaceId = workspace_id() AND taskId = ? AND lease > ?")
        .get(taskId, new Date().toISOString()))
        throw new PendingRunError("Wait for the chat response to finish before resetting the task.");
      const status = this.listColumns(task.boardId)[0];
      if (!status) throw new ColumnValidationError("Add a board column before resetting the task.");
      this.discardTaskWorktree(task);
      this.db.prepare("DELETE FROM task_artifacts WHERE taskId = ?").run(taskId);
      this.db.prepare("UPDATE artifacts SET taskId = NULL, runId = NULL WHERE workspaceId = workspace_id() AND taskId = ?").run(taskId);
      for (const table of ["comments", "chat_sessions", "runs", "task_usage"])
        this.db.prepare(`DELETE FROM ${table} WHERE workspaceId = workspace_id() AND taskId = ?`).run(taskId);
      this.db.prepare("UPDATE tasks SET status = ?, agentStatus = 'Not started', autoRun = 0, autoWorkflow = 0 WHERE workspaceId = workspace_id() AND id = ?")
        .run(status, taskId);
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  delete(id: string) {
    this.assertOwnership("tasks", id);
    this.transaction(() => {
      this.assertIdle(id, "archiving the task");
      if (this.db.prepare("SELECT id FROM chat_sessions WHERE workspaceId = workspace_id() AND taskId = ? AND lease > ?").get(id, new Date().toISOString()))
        throw new PendingRunError("Wait for the chat response before archiving the task.");
      const task = this.readTask(id);
      if (task) this.discardTaskWorktree(task);
      this.db.prepare("UPDATE tasks SET archivedAt = COALESCE(archivedAt, ?), autoRun = 0, autoWorkflow = 0 WHERE workspaceId = workspace_id() AND id = ?").run(new Date().toISOString(), id);
      this.db.prepare("UPDATE comments SET feedbackStatus = 'cancelled' WHERE workspaceId = workspace_id() AND taskId = ? AND feedbackStatus = 'pending'").run(id);
      this.db.prepare("UPDATE runs SET status = 'Stopped', finishedAt = ? WHERE workspaceId = workspace_id() AND taskId = ? AND status = 'Waiting'").run(new Date().toISOString(), id);
    });
    this.cleanupWorktrees(id);
  }

  private assertIdle(taskId: string, action = "deleting the task") {
    if (
      this.db
        .prepare(
          "SELECT id FROM runs WHERE runs.workspaceId = workspace_id() AND taskId = ? AND status IN ('Queued', 'Running')",
        )
        .get(taskId)
    ) {
      throw new PendingRunError(
        `Wait for this agent run to finish before ${action}.`,
      );
    }
  }

  addComment(comment: TaskComment) {
    this.assertOwnership("tasks", comment.taskId);
    if (comment.runId) {
      this.assertOwnership("runs", comment.runId);
      if (!this.history(comment.taskId).some((run) => run.id === comment.runId))
        throw new CommentValidationError("Choose a run belonging to this task.");
    }
    this.db.exec("SAVEPOINT publish_comment");
    try {
      let references;
      try { references = artifactMentions(comment.body); }
      catch { throw new CommentValidationError("Choose a valid artifact reference."); }
      this.db
        .prepare(
          "INSERT INTO comments (workspaceId, id, taskId, body, createdAt, authorName, recommendation, feedbackStatus, runId, parentCommentId, authorRole, responseType) VALUES (workspace_id(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          comment.id,
          comment.taskId,
          comment.body,
          new Date(comment.createdAt).toISOString(),
          comment.authorName ?? null,
          comment.recommendation ?? null,
          comment.feedbackStatus ?? null,
          comment.runId ?? null,
          comment.parentCommentId ?? null,
          comment.authorRole ?? null,
          comment.responseType ?? null,
        );
      this.attachCommentArtifacts(comment.id, references);
      this.db.exec("RELEASE publish_comment");
    } catch (error) {
      this.db.exec("ROLLBACK TO publish_comment; RELEASE publish_comment");
      throw error;
    }
  }

  listAgents(): AgentProfile[] {
    return (
      this.db
        .prepare("SELECT id, name, tool, model, effort, instructions, permissions, requireApprovalBeforeEdits FROM agents WHERE agents.workspaceId = workspace_id() ORDER BY rowid")
        .all() as unknown as AgentProfile[]
    ).map((agent) => ({ ...agent, requireApprovalBeforeEdits: Boolean(agent.requireApprovalBeforeEdits) }));
  }

  saveAgent(input: unknown): AgentProfile {
    this.assertInputOwnership(input);
    const agent = parseAgentProfile(input);
    this.assertOwnership("agents", agent.id);
    const result = this.db
      .prepare(
        `INSERT INTO agents (workspaceId, id, name, tool, model, effort, instructions, permissions, requireApprovalBeforeEdits)
      VALUES (workspace_id(), ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, tool=excluded.tool, model=excluded.model, effort=excluded.effort,
      instructions=excluded.instructions, permissions=excluded.permissions, requireApprovalBeforeEdits=excluded.requireApprovalBeforeEdits
      WHERE agents.workspaceId = excluded.workspaceId`,
      )
      .run(
        agent.id,
        agent.name,
        agent.tool,
        agent.model,
        agent.effort,
        agent.instructions,
        agent.permissions,
        agent.requireApprovalBeforeEdits ? 1 : 0,
      );
    if (!result.changes) throw new WorkspaceOwnershipError("This agent belongs to another workspace.");
    return agent;
  }

  deleteAgent(id: string) {
    this.assertOwnership("agents", id);
    this.db.prepare("DELETE FROM agents WHERE agents.workspaceId = workspace_id() AND id = ?").run(id);
  }

  listAllColumnAgents() {
    return this.listBoards().flatMap((board) => this.listColumnAgents(board.id).map((assignment) => ({ ...assignment, boardName: board.name })));
  }

  listColumnAgents(boardId = this.boardId): ColumnAssignment[] {
    return (
      this.db
        .prepare("SELECT column, agentId FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column_assignments.boardId = ? ORDER BY rowid")
        .all(boardId) as unknown as ColumnAssignment[]
    ).map((assignment) => ({ ...assignment }));
  }

  assignColumnAgent(input: unknown): ColumnAssignment | null {
    if (!input || typeof input !== "object")
      throw new AgentValidationError("Choose a column and agent.");
    this.assertInputOwnership(input);
    const { column, agentId } = input as {
      column: ColumnAssignment["column"];
      agentId: unknown;
    };
    if (!this.listColumns().includes(column))
      throw new AgentValidationError("Choose an existing board column.");
    if (agentId === null) {
      this.db
        .prepare("DELETE FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column_assignments.boardId = board_id() AND column = ?")
        .run(column);
      return null;
    }
    if (
      typeof agentId !== "string" ||
      !this.db.prepare("SELECT id FROM agents WHERE agents.workspaceId = workspace_id() AND id = ?").get(agentId)
    ) {
      throw new AgentValidationError(
        "Choose a saved agent from the Agents screen.",
      );
    }
    this.db
      .prepare(
        "INSERT INTO column_assignments (workspaceId, boardId, column, agentId) VALUES (workspace_id(), board_id(), ?, ?) ON CONFLICT(boardId, column) DO UPDATE SET agentId=excluded.agentId",
      )
      .run(column, agentId);
    return { column, agentId };
  }

  close() {
    this.db.close();
  }
}
