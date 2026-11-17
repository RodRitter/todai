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
import { processIdentity } from "./process-identity.ts";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Task, type TaskComment } from "../domain/task.ts";

export class ColumnValidationError extends Error {}

export class PendingRunError extends Error {}
export class FeedbackValidationError extends Error {}
export class CommentValidationError extends Error {}

export type AgentRun = {
  id: string;
  taskId: string;
  column: Task["status"];
  profile: AgentProfile;
  status: "Queued" | "Running" | "Complete" | "Failed" | "Interrupted" | "Waiting";
  kind?: "intent" | "reply" | null;
  commentId?: string | null;
  replyPlan?: AgentProfile[] | null;
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

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    initializeSchema(this.db);
  }

  getDefaultExecutor() {
    const value = this.db.prepare("SELECT value FROM settings WHERE key = 'defaultExecutor'").get()?.value;
    return value === undefined ? "codex" as const : parseExecutionTool(value);
  }

  setDefaultExecutor(value: unknown) {
    const tool = parseExecutionTool(value);
    this.db.prepare("INSERT INTO settings (key, value) VALUES ('defaultExecutor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(tool);
    return tool;
  }

  getWorkspacePath(): string | undefined {
    return this.db
      .prepare("SELECT value FROM settings WHERE key = 'workspacePath'")
      .get()?.value as string | undefined;
  }

  setWorkspacePath(path: string) {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('workspacePath', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(path);
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
      const columns = this.db.prepare("SELECT id, name FROM board_columns ORDER BY position").all() as { id: string; name: string }[];
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
      if ((columnMode === "replace" || conflictMode === "overwrite") && data.columns.length && this.db.prepare("SELECT id FROM runs WHERE status IN ('Queued', 'Running') LIMIT 1").get())
        throw new ConfigurationValidationError("Wait for queued and active runs to finish before replacing or overwriting columns.");
      if (columnMode === "replace" && data.columns.length) {
        this.db.exec("DELETE FROM column_assignments; DELETE FROM board_columns;");
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
        const previous = conflictMode === "overwrite" ? this.db.prepare("SELECT name FROM board_columns WHERE id = ?").get(column.id)?.name as string | undefined : undefined;
        let name = column.name;
        let suffix = 2;
        while (existing.some((item) => item !== previous && item.toLowerCase() === name.toLowerCase())) {
          const ending = ` (imported ${suffix++})`;
          name = column.name.slice(0, 80 - ending.length) + ending;
        }
        if (previous !== undefined) {
          this.db.prepare("DELETE FROM column_assignments WHERE column = ?").run(previous);
          this.db.prepare("UPDATE board_columns SET name = ? WHERE id = ?").run(name, column.id);
          this.db.prepare("UPDATE tasks SET status = ? WHERE status = ?").run(name, previous);
          existing[existing.indexOf(previous)] = name;
        } else {
          this.db.prepare("INSERT INTO board_columns (id, name, position) VALUES (?, ?, ?)").run(conflictMode === "overwrite" ? column.id : randomUUID(), name, existing.length);
          existing.push(name);
        }
        columnNames.set(column.id, name);
      }
      for (const assignment of data.assignments) {
        this.assignColumnAgent({ column: columnNames.get(assignment.columnId)!, agentId: agentIds.get(assignment.agentId)! });
      }
      if (columnMode === "replace" && data.columns.length) {
        this.db.prepare("UPDATE comments SET feedbackStatus = 'cancelled' WHERE feedbackStatus = 'pending'").run();
        this.db.prepare("UPDATE tasks SET status = ?, agentStatus = 'Not started'").run(columnNames.get(data.columns[0].id)!);
      }
      return { agents: data.agents.length, columns: data.columns.length, assignments: data.assignments.length };
    });
  }

  listColumns(): string[] {
    return this.db
      .prepare("SELECT name FROM board_columns ORDER BY position")
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
        .prepare("INSERT INTO board_columns (id, name, position) VALUES (?, ?, ?)")
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
        .prepare("UPDATE board_columns SET name = ? WHERE name = ?")
        .run(name, column);
      this.db
        .prepare("UPDATE tasks SET status = ? WHERE status = ?")
        .run(name, column);
      this.db
        .prepare("UPDATE column_assignments SET column = ? WHERE column = ?")
        .run(name, column);
      this.db
        .prepare(
          "UPDATE runs SET column = ? WHERE column = ? AND status IN ('Queued', 'Running', 'Waiting')",
        )
        .run(name, column);
      this.db
        .prepare(
          "UPDATE runs SET interruptionColumn = ? WHERE interruptionColumn = ? AND status = 'Running'",
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
          .prepare("SELECT id FROM tasks WHERE status = ? LIMIT 1")
          .get(column)
      ) {
        throw new ColumnValidationError(
          "Move all tasks to another column before deleting this column.",
        );
      }
      this.db
        .prepare("DELETE FROM column_assignments WHERE column = ?")
        .run(column);
      this.db.prepare("DELETE FROM board_columns WHERE name = ?").run(column);
      for (const [position, name] of this.listColumns().entries()) {
        this.db
          .prepare("UPDATE board_columns SET position = ? WHERE name = ?")
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
          .prepare("UPDATE board_columns SET position = ? WHERE name = ?")
          .run(position, name);
      }
      return this.listColumns();
    });
  }

  list(): Task[] {
    return (
      this.db
        .prepare("SELECT * FROM tasks ORDER BY rowid")
        .all() as unknown as Task[]
    ).map((task) => ({
      ...task,
      autoWorkflow: Boolean(task.autoWorkflow),
      comments: this.db
        .prepare(
          `SELECT comments.* FROM comments WHERE taskId = ? AND NOT EXISTS (
            SELECT 1 FROM runs WHERE runs.kind = 'intent' AND runs.taskId = comments.taskId
              AND (runs.id = comments.runId OR (
                runs.finishedAt = comments.createdAt AND runs.summary = comments.body
                AND json_extract(runs.profile, '$.name') = comments.authorName
              ))
          ) ORDER BY createdAt, rowid`,
        )
        .all(task.id) as unknown as NonNullable<Task["comments"]>,
    }));
  }

  save(input: unknown): Task {
    if (!input || typeof input !== "object") throw new Error("Invalid task.");
    const task = input as Task;
    if (
      typeof task.id !== "string" ||
      !task.id.trim() ||
      typeof task.title !== "string" ||
      !task.title.trim() ||
      typeof task.description !== "string" ||
      !this.listColumns().includes(task.status) ||
      (task.autoWorkflow !== undefined &&
        typeof task.autoWorkflow !== "boolean")
    ) {
      throw new Error("Enter a title and valid task properties.");
    }
    return this.transaction(() => {
      const previous = this.list().find((item) => item.id === task.id);
      if (previous && previous.status !== task.status) {
        this.db.prepare("UPDATE comments SET feedbackStatus = 'cancelled' WHERE taskId = ? AND feedbackStatus = 'pending'").run(task.id);
        this.db
          .prepare(
            `UPDATE runs SET status = 'Interrupted', finishedAt = ?, summary = ?
          WHERE taskId = ? AND status = 'Queued'`,
          )
          .run(
            new Date().toISOString(),
            `Queued run cancelled because the task moved to ${task.status}.`,
            task.id,
          );
        this.db
          .prepare(
            "UPDATE runs SET interruptionColumn = ? WHERE taskId = ? AND status = 'Running'",
          )
          .run(task.status, task.id);
        this.db
          .prepare(
            `UPDATE tasks SET agentStatus = CASE
          WHEN EXISTS (SELECT 1 FROM runs WHERE taskId = ? AND status = 'Running') THEN 'Running'
          ELSE 'Not started' END WHERE id = ?`,
          )
          .run(task.id, task.id);
      }
      this.db
        .prepare(
          `INSERT INTO tasks (id, title, description, status, autoWorkflow) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
        status=excluded.status, autoWorkflow=excluded.autoWorkflow`,
        )
        .run(
          task.id,
          task.title.trim(),
          task.description,
          task.status,
          Number(task.autoWorkflow ?? previous?.autoWorkflow ?? false),
        );
      if (!previous || previous.status !== task.status) {
        this.queueAgent(task.id, task.status);
      }
      return this.list().find((item) => item.id === task.id)!;
    });
  }

  private queueAgent(taskId: string, column: string) {
    const assignment = this.listColumnAgents().find(
      (item) => item.column === column,
    );
    const profile = this.listAgents().find(
      (item) => item.id === assignment?.agentId,
    );
    if (profile) {
      this.db
        .prepare(
          `INSERT INTO runs (id, taskId, column, profile, status, createdAt)
        VALUES (?, ?, ?, ?, 'Queued', ?)`,
        )
        .run(
          randomUUID(),
          taskId,
          column,
          JSON.stringify(profile),
          new Date().toISOString(),
        );
      this.db
        .prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE id = ?")
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
    const rows =
      taskId === undefined
        ? this.db.prepare("SELECT * FROM runs ORDER BY rowid").all()
        : this.db
            .prepare("SELECT * FROM runs WHERE taskId = ? ORDER BY rowid")
            .all(taskId);
    return rows.map((row) => ({
      ...row,
      profile: JSON.parse(row.profile as string),
      replyPlan: row.replyPlan ? JSON.parse(row.replyPlan as string) : null,
    })) as AgentRun[];
  }

  claimRun(): AgentRun | undefined {
    return this.transaction(() => {
      if (this.db.prepare("SELECT id FROM runs WHERE status = 'Running'").get())
        return;
      const waiting = new Set(this.list().filter((task) => task.comments?.some((comment) => comment.feedbackStatus === "pending")).map((task) => task.id));
      const run = this.history().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((run) => run.status === "Queued" && !waiting.has(run.taskId));
      if (!run) return;
      const startedAt = new Date().toISOString();
      const ownerIdentity = processIdentity(process.pid);
      if (!ownerIdentity)
        throw new Error("Could not identify the app process.");
      this.db
        .prepare(
          "UPDATE runs SET status = 'Running', startedAt = ?, ownerPid = ?, ownerIdentity = ? WHERE id = ?",
        )
        .run(startedAt, process.pid, ownerIdentity, run.id);
      this.db
        .prepare("UPDATE tasks SET agentStatus = 'Running' WHERE id = ?")
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
    return Boolean(
      this.db
        .prepare("SELECT interruptionColumn FROM runs WHERE id = ?")
        .get(runId)?.interruptionColumn,
    );
  }

  recordRunner(runId: string, pid: number) {
    this.db
      .prepare(
        "UPDATE runs SET runnerPid = ?, runnerIdentity = ? WHERE id = ? AND status = 'Running'",
      )
      .run(pid, processIdentity(pid), runId);
  }

  finishRun(
    runId: string,
    status: "Complete" | "Failed" | "Interrupted" | "Waiting",
    summary: string,
    recommendation?: string,
    replyPlan?: AgentProfile[],
  ) {
    this.transaction(() => {
      const run = this.history().find(
        (run) => run.id === runId && run.status === "Running",
      );
      if (!run) return;
      if (run.interruptionColumn) {
        status = "Interrupted";
        summary = `Agent run interrupted because the task moved to ${run.interruptionColumn}. Workspace changes were preserved.`;
      }
      if (status === "Waiting" && (!summary.trim() || !recommendation?.trim()))
        throw new FeedbackValidationError("Feedback requests require a question and recommendation.");
      const finishedAt = new Date().toISOString();
      this.db
        .prepare(
          "UPDATE runs SET status = ?, finishedAt = ?, summary = ? WHERE id = ?",
        )
        .run(status, finishedAt, summary, runId);
      if (run.kind && (status === "Complete" || status === "Failed")) {
        const remaining = replyPlan ?? run.replyPlan ?? [];
        const [next, ...rest] = remaining;
        if (next) this.queueCommentRun(run.taskId, run.column, next, "reply", run.commentId!, rest, run.createdAt);
      }
      this.db
        .prepare(
          `UPDATE tasks SET agentStatus = CASE
        WHEN EXISTS (SELECT 1 FROM comments WHERE taskId = ? AND feedbackStatus = 'pending') OR ? = 'Waiting' THEN 'Waiting'
        WHEN EXISTS (SELECT 1 FROM runs WHERE taskId = ? AND status = 'Queued') THEN 'Queued'
        ELSE ? END WHERE id = ?`,
        )
        .run(run.taskId, status, run.taskId, status, run.taskId);
      if (run.kind !== "intent") this.addComment({
        id: randomUUID(),
        taskId: run.taskId,
        body: summary,
        createdAt: finishedAt,
        authorName: run.profile.name,
        ...(status === "Waiting" ? { recommendation, feedbackStatus: "pending", runId } : {}),
      });
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
              "UPDATE tasks SET status = ?, agentStatus = 'Not started' WHERE id = ?",
            )
            .run(nextColumn, task.id);
          this.queueAgent(task.id, nextColumn);
        }
      }
    });
  }

  answerFeedback(taskId: unknown, commentId: unknown, body: unknown): Task {
    if (typeof taskId !== "string" || typeof commentId !== "string" ||
        typeof body !== "string" || !body.trim())
      throw new FeedbackValidationError("Enter a feedback reply.");
    return this.transaction(() => {
      const task = this.list().find((item) => item.id === taskId);
      const request = task?.comments?.find((item) => item.id === commentId && item.feedbackStatus === "pending");
      const run = request && this.history(taskId).find((item) => item.id === request.runId);
      if (!task || task.agentStatus !== "Waiting" || !request || !run)
        throw new FeedbackValidationError("This feedback request is no longer pending. Reload the task.");
      this.db.prepare("UPDATE comments SET feedbackStatus = 'answered' WHERE id = ?").run(commentId);
      this.addComment({ id: randomUUID(), taskId, body: body.trim(), createdAt: new Date().toISOString(), authorName: "Human", runId: run.id });
      this.db.prepare("INSERT INTO runs (id, taskId, column, profile, status, createdAt, kind, commentId, replyPlan) VALUES (?, ?, ?, ?, 'Queued', ?, ?, ?, ?)")
        .run(randomUUID(), taskId, task.status, JSON.stringify(run.profile), run.createdAt, run.kind ?? null, run.commentId ?? null, run.replyPlan ? JSON.stringify(run.replyPlan) : null);
      this.db.prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE id = ?").run(taskId);
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  postComment(taskId: unknown, body: unknown): Task {
    if (typeof taskId !== "string" || typeof body !== "string" || !body.trim())
      throw new CommentValidationError("Enter a comment.");
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
      if (profiles.length) {
        this.queueCommentRun(taskId, task.status, intentProfile(this.getDefaultExecutor()), "intent", commentId, profiles);
        if (task.agentStatus !== "Running" && task.agentStatus !== "Waiting")
          this.db.prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE id = ?").run(taskId);
      }
      return this.list().find((item) => item.id === taskId)!;
    });
  }

  private queueCommentRun(taskId: string, column: string, profile: AgentProfile, kind: "intent" | "reply", commentId: string, replyPlan: AgentProfile[], createdAt = new Date().toISOString()) {
    this.db.prepare("INSERT INTO runs (id, taskId, column, profile, status, createdAt, kind, commentId, replyPlan) VALUES (?, ?, ?, ?, 'Queued', ?, ?, ?, ?)")
      .run(randomUUID(), taskId, column, JSON.stringify(profile), createdAt, kind, commentId, JSON.stringify(replyPlan));
  }

  delete(id: string) {
    this.transaction(() => {
      this.assertIdle(id);
      this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    });
  }

  private assertIdle(taskId: string) {
    if (
      this.db
        .prepare(
          "SELECT id FROM runs WHERE taskId = ? AND status IN ('Queued', 'Running')",
        )
        .get(taskId)
    ) {
      throw new PendingRunError(
        "Wait for this agent run to finish before deleting the task.",
      );
    }
  }

  addComment(comment: TaskComment) {
    this.db
      .prepare(
        "INSERT INTO comments (id, taskId, body, createdAt, authorName, recommendation, feedbackStatus, runId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
  }

  listAgents(): AgentProfile[] {
    return (
      this.db
        .prepare("SELECT * FROM agents ORDER BY rowid")
        .all() as unknown as AgentProfile[]
    ).map((agent) => ({ ...agent }));
  }

  saveAgent(input: unknown): AgentProfile {
    const agent = parseAgentProfile(input);
    this.db
      .prepare(
        `INSERT INTO agents (id, name, tool, model, effort, instructions, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, tool=excluded.tool, model=excluded.model, effort=excluded.effort,
      instructions=excluded.instructions, permissions=excluded.permissions`,
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
    return agent;
  }

  deleteAgent(id: string) {
    this.db.prepare("DELETE FROM agents WHERE id = ?").run(id);
  }

  listColumnAgents(): ColumnAssignment[] {
    return (
      this.db
        .prepare("SELECT * FROM column_assignments ORDER BY rowid")
        .all() as unknown as ColumnAssignment[]
    ).map((assignment) => ({ ...assignment }));
  }

  assignColumnAgent(input: unknown): ColumnAssignment | null {
    if (!input || typeof input !== "object")
      throw new AgentValidationError("Choose a column and agent.");
    const { column, agentId } = input as {
      column: ColumnAssignment["column"];
      agentId: unknown;
    };
    if (!this.listColumns().includes(column))
      throw new AgentValidationError("Choose an existing board column.");
    if (agentId === null) {
      this.db
        .prepare("DELETE FROM column_assignments WHERE column = ?")
        .run(column);
      return null;
    }
    if (
      typeof agentId !== "string" ||
      !this.db.prepare("SELECT id FROM agents WHERE id = ?").get(agentId)
    ) {
      throw new AgentValidationError(
        "Choose a saved agent from the Agents screen.",
      );
    }
    this.db
      .prepare(
        "INSERT INTO column_assignments (column, agentId) VALUES (?, ?) ON CONFLICT(column) DO UPDATE SET agentId=excluded.agentId",
      )
      .run(column, agentId);
    return { column, agentId };
  }

  close() {
    this.db.close();
  }
}
