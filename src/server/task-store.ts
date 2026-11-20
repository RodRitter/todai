import { groupActivity } from "../domain/activity.ts";
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
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Task, type TaskComment } from "../domain/task.ts";

import type { ExecutionState } from "../domain/execution.ts";
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
  status: "Queued" | "Running" | "Complete" | "Failed" | "Interrupted" | "Stopped" | "Waiting";
  kind?: "intent" | "reply" | null;
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

  readonly workspaceId: string;
  readonly databasePath: string;

  constructor(path: string, workspaceId?: string, options: { seedWorkspace?: boolean } = {}) {
    this.databasePath = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    initializeSchema(this.db, options.seedWorkspace);
    this.workspaceId = workspaceId ?? (this.listWorkspaces()[0] ?? this.listArchivedWorkspaces()[0])?.id ?? "";
    if (workspaceId && !this.listWorkspaces().some((workspace) => workspace.id === workspaceId)) {
      this.db.close();
      throw new WorkspaceOwnershipError("Choose an existing workspace. Archived workspaces must be restored first.");
    }
    // The SQL scope belongs to this connection and never follows a selected UI view.
    this.db.function("workspace_id", () => this.workspaceId);
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
      for (const [position, column] of setup.columns.entries()) {
        this.db.prepare("INSERT INTO board_columns (id, name, position, workspaceId) VALUES (?, ?, ?, ?)").run(randomUUID(), column, position, workspace.id);
      }
      for (const id of setup.starterAgentIds) {
        const agent = starterAgentProfile(id, randomUUID());
        this.db.prepare("INSERT INTO agents (workspaceId, id, name, tool, model, effort, instructions, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(workspace.id, agent.id, agent.name, agent.tool, agent.model, agent.effort, agent.instructions, agent.permissions);
      }
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

  setWorkspacePath(path: string) {
    return this.transaction(() => {
      this.assertWorkspaceActive();
      if (path === this.getWorkspacePath()) return;
      const state = this.executionState();
      if (state.active) throw new RunValidationError("Stop the running agent before changing a directory.");
      if (!state.paused && this.history().some((run) => run.status === "Queued"))
        throw new RunValidationError("Pause the global queue before changing this directory.");
      this.db.prepare("UPDATE workspaces SET path = ? WHERE id = workspace_id()").run(path);
    });
  }

  boardSnapshot() {
    return this.transaction(() => ({
      tasks: this.list(),
      columns: this.listColumns(),
      assignments: this.listColumnAgents(),
    }));
  }

  exportConfiguration(): Configuration {
    return this.transaction(() => {
      const columns = this.db.prepare("SELECT id, name FROM board_columns WHERE board_columns.workspaceId = workspace_id() ORDER BY position").all() as { id: string; name: string }[];
      return {
        format: "todai-configuration", version: 1,
        agents: this.listAgents(), columns: columns.map((column) => ({ ...column })),
        assignments: this.listColumnAgents().map((assignment) => ({
          columnId: columns.find((column) => column.name === assignment.column)!.id,
          agentId: assignment.agentId,
        })),
      };
    });
  }

  importConfiguration(input: unknown, columnMode: unknown = "add", conflictMode: unknown = "copy") {
    if (columnMode !== "add" && columnMode !== "replace")
      throw new ConfigurationValidationError("Choose whether to add or replace columns.");
    if (conflictMode !== "copy" && conflictMode !== "overwrite")
      throw new ConfigurationValidationError("Choose whether to overwrite matching IDs or create copies.");
    const data = parseConfiguration(input);
    if (!data.agents.length && !data.columns.length)
      throw new ConfigurationValidationError("Select at least one agent or column.");
    return this.transaction(() => {
      if ((columnMode === "replace" || conflictMode === "overwrite") && data.columns.length && this.db.prepare("SELECT id FROM runs WHERE runs.workspaceId = workspace_id() AND status IN ('Queued', 'Running') LIMIT 1").get())
        throw new ConfigurationValidationError("Wait for queued and active runs to finish before replacing or overwriting columns.");
      if (columnMode === "replace" && data.columns.length) {
        this.db.exec("DELETE FROM column_assignments WHERE workspaceId = workspace_id(); DELETE FROM board_columns WHERE workspaceId = workspace_id();");
      }
      if (conflictMode === "overwrite") {
        for (const agent of data.agents) this.assertOwnership("agents", agent.id);
        for (const column of data.columns) this.assertOwnership("board_columns", column.id);
      }
      const agentIds = new Map<string, string>();
      for (const agent of data.agents) {
        const id = conflictMode === "overwrite" ? agent.id : randomUUID();
        this.saveAgent({ ...agent, id });
        agentIds.set(agent.id, id);
      }
      const columnNames = new Map<string, string>();
      const existing = this.listColumns();
      for (const column of data.columns) {
        const previous = conflictMode === "overwrite" ? this.db.prepare("SELECT name FROM board_columns WHERE board_columns.workspaceId = workspace_id() AND id = ?").get(column.id)?.name as string | undefined : undefined;
        let name = column.name;
        let suffix = 2;
        while (existing.some((item) => item !== previous && item.toLowerCase() === name.toLowerCase())) {
          const ending = ` (imported ${suffix++})`;
          name = column.name.slice(0, 80 - ending.length) + ending;
        }
        if (previous !== undefined) {
          this.db.prepare("DELETE FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column = ?").run(previous);
          this.db.prepare("UPDATE board_columns SET name = ? WHERE board_columns.workspaceId = workspace_id() AND id = ?").run(name, column.id);
          this.db.prepare("UPDATE tasks SET status = ? WHERE tasks.workspaceId = workspace_id() AND status = ?").run(name, previous);
          existing[existing.indexOf(previous)] = name;
        } else {
          this.db.prepare("INSERT INTO board_columns (workspaceId, id, name, position) VALUES (workspace_id(), ?, ?, ?)").run(conflictMode === "overwrite" ? column.id : randomUUID(), name, existing.length);
          existing.push(name);
        }
        columnNames.set(column.id, name);
      }
      for (const assignment of data.assignments) {
        this.assignColumnAgent({ column: columnNames.get(assignment.columnId)!, agentId: agentIds.get(assignment.agentId)! });
      }
      if (columnMode === "replace" && data.columns.length) {
        this.db.prepare("UPDATE comments SET feedbackStatus = 'cancelled' WHERE comments.workspaceId = workspace_id() AND feedbackStatus = 'pending'").run();
        this.db.prepare("UPDATE tasks SET status = ?, agentStatus = 'Not started' WHERE tasks.workspaceId = workspace_id()").run(columnNames.get(data.columns[0].id)!);
      }
      return { agents: data.agents.length, columns: data.columns.length, assignments: data.assignments.length };
    });
  }

  listColumns(): string[] {
    return this.db
      .prepare("SELECT name FROM board_columns WHERE board_columns.workspaceId = workspace_id() ORDER BY position")
      .all()
      .map((row) => row.name as string);
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
        .prepare("INSERT INTO board_columns (workspaceId, id, name, position) VALUES (workspace_id(), ?, ?, ?)")
        .run(randomUUID(), name, this.listColumns().length);
      return this.listColumns();
    });
  }

  renameColumn(column: unknown, input: unknown): string[] {
    return this.transaction(() => {
      if (typeof column !== "string" || !this.listColumns().includes(column)) {
        throw new ColumnValidationError(
          "Choose an existing column. Reload settings and try again.",
        );
      }
      const name = this.columnName(input, column);
      this.db
        .prepare("UPDATE board_columns SET name = ? WHERE board_columns.workspaceId = workspace_id() AND name = ?")
        .run(name, column);
      this.db
        .prepare("UPDATE tasks SET status = ? WHERE tasks.workspaceId = workspace_id() AND status = ?")
        .run(name, column);
      this.db
        .prepare("UPDATE column_assignments SET column = ? WHERE column_assignments.workspaceId = workspace_id() AND column = ?")
        .run(name, column);
      this.db
        .prepare(
          "UPDATE runs SET column = ? WHERE runs.workspaceId = workspace_id() AND column = ? AND status IN ('Queued', 'Running', 'Waiting')",
        )
        .run(name, column);
      this.db
        .prepare(
          "UPDATE runs SET interruptionColumn = ? WHERE runs.workspaceId = workspace_id() AND interruptionColumn = ? AND status = 'Running'",
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
          .prepare("SELECT id FROM tasks WHERE tasks.workspaceId = workspace_id() AND status = ? LIMIT 1")
          .get(column)
      ) {
        throw new ColumnValidationError(
          "Move all tasks to another column before deleting this column.",
        );
      }
      this.db
        .prepare("DELETE FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column = ?")
        .run(column);
      this.db.prepare("DELETE FROM board_columns WHERE board_columns.workspaceId = workspace_id() AND name = ?").run(column);
      for (const [position, name] of this.listColumns().entries()) {
        this.db
          .prepare("UPDATE board_columns SET position = ? WHERE board_columns.workspaceId = workspace_id() AND name = ?")
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
          .prepare("UPDATE board_columns SET position = ? WHERE board_columns.workspaceId = workspace_id() AND name = ?")
          .run(position, name);
      }
      return this.listColumns();
    });
  }

  list(): Task[] {
    return (
      this.db
        .prepare("SELECT * FROM tasks WHERE tasks.workspaceId = workspace_id() ORDER BY rowid")
        .all() as unknown as Task[]
    ).map((task) => ({
      ...task,
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
          const artifacts = this.db.prepare("SELECT artifactId, revisionId FROM comment_artifacts WHERE commentId = ? ORDER BY artifactId, revisionId").all(row.id).map((ref) => ({ ...ref }));
          return { ...row, ...(artifacts.length ? { artifacts } : {}) } as TaskComment;
        }),
    }));
  }

  save(input: unknown): Task {
    if (!input || typeof input !== "object") throw new Error("Invalid task.");
    this.assertInputOwnership(input);
    const task = input as Task;
    if (
      typeof task.id !== "string" ||
      !task.id.trim() ||
      typeof task.title !== "string" ||
      !task.title.trim() ||
      typeof task.description !== "string" ||
      !this.listColumns().includes(task.status) ||
      (task.autoWorkflow !== undefined &&
        typeof task.autoWorkflow !== "boolean") ||
      (task.autoRun !== undefined && typeof task.autoRun !== "boolean")
    ) {
      throw new Error("Enter a title and valid task properties.");
    }
    return this.transaction(() => {
      this.assertOwnership("tasks", task.id);
      const previous = this.list().find((item) => item.id === task.id);
      if (previous && previous.status !== task.status) {
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
          `INSERT INTO tasks (workspaceId, id, title, description, status, autoWorkflow, autoRun) VALUES (workspace_id(), ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
        status=excluded.status, autoWorkflow=excluded.autoWorkflow, autoRun=excluded.autoRun
        WHERE tasks.workspaceId = excluded.workspaceId`,
        )
        .run(
          task.id,
          task.title.trim(),
          task.description,
          task.status,
          Number(task.autoWorkflow ?? previous?.autoWorkflow ?? false),
          Number(task.autoRun ?? previous?.autoRun ?? false),
        );
      if (previous?.agentStatus !== "Stopped" && (!previous || previous.status !== task.status) && (task.autoRun ?? previous?.autoRun ?? false)) {
        this.queueAgent(task.id, task.status);
      }
      return this.list().find((item) => item.id === task.id)!;
    });
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
      if (!this.listColumnAgents().some((assignment) => assignment.column === task.status))
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
    const assignment = this.listColumnAgents().find(
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
      if (status === "Waiting" && (!summary.trim() || !recommendation?.trim()))
        throw new FeedbackValidationError("Feedback requests require a question and recommendation.");
      const finishedAt = new Date().toISOString();
      this.db
        .prepare(
          "UPDATE runs SET status = ?, finishedAt = ?, summary = ? WHERE runs.workspaceId = workspace_id() AND id = ?",
        )
        .run(status, finishedAt, summary, runId);
      if (run.kind && (status === "Complete" || (status === "Failed" && run.kind === "reply"))) {
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
          body: summary,
          createdAt: finishedAt,
          authorName: run.profile.name,
          ...(status === "Waiting" ? { recommendation, feedbackStatus: "pending" } : {}),
        });
        if (status === "Complete" || status === "Waiting") this.attachCommentArtifacts(commentId, artifacts);
      }
      const task = this.list().find((task) => task.id === run.taskId);
      if (
        status === "Complete" &&
        !run.kind &&
        !this.history(run.taskId).some((item) => item.status === "Queued") &&
        task?.autoWorkflow &&
        task.status === run.column
      ) {
        const columns = this.listColumns();
        const index = columns.indexOf(task.status);
        const nextColumn = index >= 0 ? columns[index + 1] : undefined;
        if (nextColumn) {
          this.db
            .prepare(
              "UPDATE tasks SET status = ? WHERE tasks.workspaceId = workspace_id() AND id = ?",
            )
            .run(nextColumn, task.id);
          if (task.autoRun) this.queueAgent(task.id, nextColumn);
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
      this.db.prepare("UPDATE comments SET feedbackStatus = 'answered' WHERE comments.workspaceId = workspace_id() AND id = ?").run(commentId);
      this.addComment({ id: randomUUID(), taskId, body: body.trim(), createdAt: new Date().toISOString(), authorName: "Human", runId: run.id });
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
      const replies = groupActivity(task.comments ?? []).find(({ message }) => message.id === commentId)?.replies ?? [];
      const deleting = [comment, ...replies];
      const ids = new Set(deleting.map((item) => item.id));
      if (deleting.some((item) => item.feedbackStatus === "pending") || this.history(taskId).some((run) => run.status === "Waiting" && run.commentId && ids.has(run.commentId)))
        throw new CommentValidationError("Answer or cancel this feedback request before deleting it.");
      const remove = this.db.prepare("DELETE FROM comments WHERE workspaceId = workspace_id() AND taskId = ? AND id = ?");
      for (const id of ids) remove.run(taskId, id);
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  postComment(taskId: unknown, body: unknown, attachments: unknown = []): Task {
    this.assertWorkspaceActive();
    if (typeof taskId !== "string" || typeof body !== "string" || !body.trim())
      throw new CommentValidationError("Enter a comment.");
    this.assertOwnership("tasks", taskId);
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      if (!task) throw new CommentValidationError("This task no longer exists.");
      const agents = this.listAgents();
      const ids = mentionedAgentIds(body, agents);
      const profiles = ids.map((id) => {
        const agent = agents.find((item) => item.id === id);
        if (!agent) throw new CommentValidationError("A tagged agent no longer exists. Remove the mention and try again.");
        return agent;
      });
      const commentId = randomUUID();
      this.addComment({ id: commentId, taskId, body: body.trim(), createdAt: new Date().toISOString(), authorName: "Human" });
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
    for (const ref of attachments) {
      if (!ref || typeof ref.artifactId !== "string" || typeof ref.revisionId !== "string" ||
          !this.db.prepare("SELECT revisionId FROM artifact_revisions WHERE id = ? AND revisionId = ? AND workspaceId = workspace_id()")
            .get(ref.artifactId, ref.revisionId))
        throw new CommentValidationError("Artifact revision not found in this workspace.");
      this.db.prepare("INSERT OR IGNORE INTO comment_artifacts (commentId, artifactId, revisionId) VALUES (?, ?, ?)")
        .run(commentId, ref.artifactId, ref.revisionId);
    }
  }

  private queueCommentRun(taskId: string, column: string, profile: AgentProfile, kind: "intent" | "reply", commentId: string, replyPlan: AgentProfile[], createdAt = new Date().toISOString()) {
    this.assertWorkspaceActive();
    this.db.prepare("INSERT INTO runs (workspaceId, workspacePath, id, taskId, column, profile, status, createdAt, kind, commentId, replyPlan) VALUES (workspace_id(), (SELECT path FROM workspaces WHERE id = workspace_id()), ?, ?, ?, ?, 'Queued', ?, ?, ?, ?)")
      .run(randomUUID(), taskId, column, JSON.stringify(profile), createdAt, kind, commentId, JSON.stringify(replyPlan));
  }

  delete(id: string) {
    this.assertOwnership("tasks", id);
    this.transaction(() => {
      this.assertIdle(id);
      this.db.prepare("DELETE FROM tasks WHERE tasks.workspaceId = workspace_id() AND id = ?").run(id);
    });
  }

  private assertIdle(taskId: string) {
    if (
      this.db
        .prepare(
          "SELECT id FROM runs WHERE runs.workspaceId = workspace_id() AND taskId = ? AND status IN ('Queued', 'Running')",
        )
        .get(taskId)
    ) {
      throw new PendingRunError(
        "Wait for this agent run to finish before deleting the task.",
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
      catch { throw new CommentValidationError("Choose a valid artifact revision reference."); }
      this.db
        .prepare(
          "INSERT INTO comments (workspaceId, id, taskId, body, createdAt, authorName, recommendation, feedbackStatus, runId) VALUES (workspace_id(), ?, ?, ?, ?, ?, ?, ?, ?)",
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
        .prepare("SELECT id, name, tool, model, effort, instructions, permissions FROM agents WHERE agents.workspaceId = workspace_id() ORDER BY rowid")
        .all() as unknown as AgentProfile[]
    ).map((agent) => ({ ...agent }));
  }

  saveAgent(input: unknown): AgentProfile {
    this.assertInputOwnership(input);
    const agent = parseAgentProfile(input);
    this.assertOwnership("agents", agent.id);
    const result = this.db
      .prepare(
        `INSERT INTO agents (workspaceId, id, name, tool, model, effort, instructions, permissions)
      VALUES (workspace_id(), ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, tool=excluded.tool, model=excluded.model, effort=excluded.effort,
      instructions=excluded.instructions, permissions=excluded.permissions
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
      );
    if (!result.changes) throw new WorkspaceOwnershipError("This agent belongs to another workspace.");
    return agent;
  }

  deleteAgent(id: string) {
    this.assertOwnership("agents", id);
    this.db.prepare("DELETE FROM agents WHERE agents.workspaceId = workspace_id() AND id = ?").run(id);
  }

  listColumnAgents(): ColumnAssignment[] {
    return (
      this.db
        .prepare("SELECT column, agentId FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() ORDER BY rowid")
        .all() as unknown as ColumnAssignment[]
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
        .prepare("DELETE FROM column_assignments WHERE column_assignments.workspaceId = workspace_id() AND column = ?")
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
        "INSERT INTO column_assignments (workspaceId, column, agentId) VALUES (workspace_id(), ?, ?) ON CONFLICT(workspaceId, column) DO UPDATE SET agentId=excluded.agentId",
      )
      .run(column, agentId);
    return { column, agentId };
  }

  close() {
    this.db.close();
  }
}
