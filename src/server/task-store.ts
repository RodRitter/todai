import { AgentValidationError, parseAgentProfile, type AgentProfile, type ColumnAssignment } from '../components/tasks/column-agent.ts';
import { processIdentity } from './process-identity.ts';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { statuses, type Task, type TaskComment } from '../components/tasks/task.ts';

export class ColumnValidationError extends Error {}

export class PendingRunError extends Error {}

export type AgentRun = {
  id: string; taskId: string; column: Task['status']; profile: AgentProfile;
  status: 'Queued' | 'Running' | 'Complete' | 'Failed' | 'Interrupted';
  interruptionColumn?: Task['status'] | null;
  createdAt: string; startedAt: string | null; finishedAt: string | null;
  summary: string | null; ownerPid: number | null; runnerPid: number | null; ownerIdentity?: string | null; runnerIdentity?: string | null;
};

export class TaskStore {
  private db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
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
    this.db.exec(`CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      column TEXT NOT NULL, profile TEXT NOT NULL, status TEXT NOT NULL,
      createdAt TEXT NOT NULL, startedAt TEXT, finishedAt TEXT, summary TEXT,
      ownerPid INTEGER, runnerPid INTEGER, ownerIdentity TEXT, runnerIdentity TEXT
    );`);
    try {
      this.db.exec('BEGIN IMMEDIATE');
      this.db.exec('CREATE TABLE IF NOT EXISTS board_columns (name TEXT PRIMARY KEY, position INTEGER NOT NULL)');
      if (!this.db.prepare('SELECT name FROM board_columns LIMIT 1').get()) {
        for (const [position, name] of statuses.entries()) {
          this.db.prepare('INSERT INTO board_columns (name, position) VALUES (?, ?)').run(name, position);
        }
      }
      const commentColumns = this.db.prepare('PRAGMA table_info(comments)').all();
      if (!commentColumns.some(column => column.name === 'authorName')) {
        this.db.exec(`ALTER TABLE comments ADD COLUMN authorName TEXT;
          UPDATE comments SET authorName = (
            SELECT json_extract(profile, '$.name') FROM runs
            WHERE runs.taskId = comments.taskId AND runs.finishedAt = comments.createdAt AND runs.summary = comments.body
          ) WHERE (SELECT COUNT(*) FROM runs
            WHERE runs.taskId = comments.taskId AND runs.finishedAt = comments.createdAt AND runs.summary = comments.body) = 1;
        `);
      }
      const runColumns = this.db.prepare('PRAGMA table_info(runs)').all();
      for (const column of ['ownerIdentity', 'runnerIdentity', 'interruptionColumn']) {
        if (!runColumns.some(item => item.name === column)) this.db.exec(`ALTER TABLE runs ADD COLUMN ${column} TEXT`);
      }
      const columns = this.db.prepare('PRAGMA table_info(tasks)').all();
      if (columns.some(column => column.name === 'owner')) {
        this.db.exec('ALTER TABLE tasks DROP COLUMN owner');
      }
      if (this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'column_agents'").get()) {
        const legacy = this.db.prepare('SELECT * FROM column_agents').all();
        for (const agent of legacy) {
          const id = randomUUID();
          this.db.prepare('INSERT INTO agents (id, name, tool, model, effort, instructions, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, agent.name, agent.tool, agent.model, agent.effort, agent.instructions, agent.permissions);
          this.db.prepare('INSERT INTO column_assignments (column, agentId) VALUES (?, ?)').run(agent.column, id);
        }
        this.db.exec('DROP TABLE column_agents');
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  boardSnapshot() {
    return this.transaction(() => ({ tasks: this.list(), columns: this.listColumns(), assignments: this.listColumnAgents() }));
  }

  listColumns(): string[] {
    return this.db.prepare('SELECT name FROM board_columns ORDER BY position').all().map(row => row.name as string);
  }

  private columnName(input: unknown, current?: string): string {
    if (typeof input !== 'string' || !input.trim() || input.trim().length > 80) {
      throw new ColumnValidationError('Enter a column name between 1 and 80 characters.');
    }
    const name = input.trim();
    if (this.listColumns().some(column => column !== current && column.toLowerCase() === name.toLowerCase())) {
      throw new ColumnValidationError('A column with that name already exists.');
    }
    return name;
  }

  createColumn(input: unknown): string[] {
    return this.transaction(() => {
      const name = this.columnName(input);
      this.db.prepare('INSERT INTO board_columns (name, position) VALUES (?, ?)').run(name, this.listColumns().length);
      return this.listColumns();
    });
  }

  renameColumn(column: unknown, input: unknown): string[] {
    return this.transaction(() => {
      if (typeof column !== 'string' || !this.listColumns().includes(column)) {
        throw new ColumnValidationError('Choose an existing column. Reload settings and try again.');
      }
      const name = this.columnName(input, column);
      this.db.prepare('UPDATE board_columns SET name = ? WHERE name = ?').run(name, column);
      this.db.prepare('UPDATE tasks SET status = ? WHERE status = ?').run(name, column);
      this.db.prepare('UPDATE column_assignments SET column = ? WHERE column = ?').run(name, column);
      this.db.prepare("UPDATE runs SET column = ? WHERE column = ? AND status IN ('Queued', 'Running')").run(name, column);
      this.db.prepare("UPDATE runs SET interruptionColumn = ? WHERE interruptionColumn = ? AND status = 'Running'").run(name, column);
      return this.listColumns();
    });
  }

  deleteColumn(column: unknown): string[] {
    return this.transaction(() => {
      const columns = this.listColumns();
      if (typeof column !== 'string' || !columns.includes(column)) {
        throw new ColumnValidationError('Choose an existing column. Reload settings and try again.');
      }
      if (columns.length === 1) throw new ColumnValidationError('Keep at least one board column.');
      if (this.db.prepare('SELECT id FROM tasks WHERE status = ? LIMIT 1').get(column)) {
        throw new ColumnValidationError('Move all tasks to another column before deleting this column.');
      }
      this.db.prepare('DELETE FROM column_assignments WHERE column = ?').run(column);
      this.db.prepare('DELETE FROM board_columns WHERE name = ?').run(column);
      for (const [position, name] of this.listColumns().entries()) {
        this.db.prepare('UPDATE board_columns SET position = ? WHERE name = ?').run(position, name);
      }
      return this.listColumns();
    });
  }

  reorderColumns(input: unknown): string[] {
    return this.transaction(() => {
      const columns = this.listColumns();
      if (!Array.isArray(input) || input.length !== columns.length || new Set(input).size !== columns.length ||
          !input.every(name => typeof name === 'string' && columns.includes(name))) {
        throw new ColumnValidationError('Include every existing column exactly once. Reload settings and try again.');
      }
      for (const [position, name] of input.entries()) {
        this.db.prepare('UPDATE board_columns SET position = ? WHERE name = ?').run(position, name);
      }
      return this.listColumns();
    });
  }

  list(): Task[] {
    return (this.db.prepare('SELECT * FROM tasks ORDER BY rowid').all() as unknown as Task[])
      .map(task => ({ ...task, comments: this.db.prepare('SELECT * FROM comments WHERE taskId = ? ORDER BY createdAt, rowid').all(task.id) as unknown as NonNullable<Task['comments']> }));
  }

  save(input: unknown): Task {
    if (!input || typeof input !== 'object') throw new Error('Invalid task.');
    const task = input as Task;
    if (typeof task.id !== 'string' || !task.id.trim() || typeof task.title !== 'string' || !task.title.trim() ||
        typeof task.description !== 'string' || !this.listColumns().includes(task.status)) {
      throw new Error('Enter a title and valid task properties.');
    }
    return this.transaction(() => {
      const previous = this.list().find(item => item.id === task.id);
      if (previous && previous.status !== task.status) {
        this.db.prepare(`UPDATE runs SET status = 'Interrupted', finishedAt = ?, summary = ?
          WHERE taskId = ? AND status = 'Queued'`).run(new Date().toISOString(), `Queued run cancelled because the task moved to ${task.status}.`, task.id);
        this.db.prepare("UPDATE runs SET interruptionColumn = ? WHERE taskId = ? AND status = 'Running'").run(task.status, task.id);
        this.db.prepare(`UPDATE tasks SET agentStatus = CASE
          WHEN EXISTS (SELECT 1 FROM runs WHERE taskId = ? AND status = 'Running') THEN 'Running'
          ELSE 'Not started' END WHERE id = ?`).run(task.id, task.id);
      }
      this.db.prepare(`INSERT INTO tasks (id, title, description, status) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
        status=excluded.status`).run(task.id, task.title.trim(), task.description, task.status);
      if (!previous || previous.status !== task.status) {
        const assignment = this.listColumnAgents().find(item => item.column === task.status);
        const profile = this.listAgents().find(item => item.id === assignment?.agentId);
        if (profile) {
          this.db.prepare(`INSERT INTO runs (id, taskId, column, profile, status, createdAt)
            VALUES (?, ?, ?, ?, 'Queued', ?)`).run(randomUUID(), task.id, task.status, JSON.stringify(profile), new Date().toISOString());
          this.db.prepare("UPDATE tasks SET agentStatus = 'Queued' WHERE id = ?").run(task.id);
        }
      }
      return this.list().find(item => item.id === task.id)!;
    });
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  history(taskId?: string): AgentRun[] {
    const rows = taskId === undefined ? this.db.prepare('SELECT * FROM runs ORDER BY rowid').all()
      : this.db.prepare('SELECT * FROM runs WHERE taskId = ? ORDER BY rowid').all(taskId);
    return rows.map(row => ({ ...row, profile: JSON.parse(row.profile as string) })) as AgentRun[];
  }

  claimRun(): AgentRun | undefined {
    return this.transaction(() => {
      if (this.db.prepare("SELECT id FROM runs WHERE status = 'Running'").get()) return;
      const run = this.history().find(run => run.status === 'Queued');
      if (!run) return;
      const startedAt = new Date().toISOString();
      const ownerIdentity = processIdentity(process.pid);
      if (!ownerIdentity) throw new Error('Could not identify the app process.');
      this.db.prepare("UPDATE runs SET status = 'Running', startedAt = ?, ownerPid = ?, ownerIdentity = ? WHERE id = ?").run(startedAt, process.pid, ownerIdentity, run.id);
      this.db.prepare("UPDATE tasks SET agentStatus = 'Running' WHERE id = ?").run(run.taskId);
      return { ...run, status: 'Running', startedAt, ownerPid: process.pid, ownerIdentity };
    });
  }

  interruptionRequested(runId: string): boolean {
    return Boolean(this.db.prepare('SELECT interruptionColumn FROM runs WHERE id = ?').get(runId)?.interruptionColumn);
  }

  recordRunner(runId: string, pid: number) {
    this.db.prepare("UPDATE runs SET runnerPid = ?, runnerIdentity = ? WHERE id = ? AND status = 'Running'").run(pid, processIdentity(pid), runId);
  }

  finishRun(runId: string, status: 'Complete' | 'Failed' | 'Interrupted', summary: string) {
    this.transaction(() => {
      const run = this.history().find(run => run.id === runId && run.status === 'Running');
      if (!run) return;
      if (run.interruptionColumn) {
        status = 'Interrupted';
        summary = `Agent run interrupted because the task moved to ${run.interruptionColumn}. Workspace changes were preserved.`;
      }
      const finishedAt = new Date().toISOString();
      this.db.prepare('UPDATE runs SET status = ?, finishedAt = ?, summary = ? WHERE id = ?').run(status, finishedAt, summary, runId);
      this.db.prepare(`UPDATE tasks SET agentStatus = CASE
        WHEN EXISTS (SELECT 1 FROM runs WHERE taskId = ? AND status = 'Queued') THEN 'Queued'
        ELSE ? END WHERE id = ?`).run(run.taskId, status, run.taskId);
      this.addComment({ id: randomUUID(), taskId: run.taskId, body: summary, createdAt: finishedAt, authorName: run.profile.name });
    });
  }

  delete(id: string) {
    this.transaction(() => {
      this.assertIdle(id);
      this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    });
  }

  private assertIdle(taskId: string) {
    if (this.db.prepare("SELECT id FROM runs WHERE taskId = ? AND status IN ('Queued', 'Running')").get(taskId)) {
      throw new PendingRunError('Wait for this agent run to finish before deleting the task.');
    }
  }

  addComment(comment: TaskComment) {
    this.db.prepare('INSERT INTO comments (id, taskId, body, createdAt, authorName) VALUES (?, ?, ?, ?, ?)')
      .run(comment.id, comment.taskId, comment.body, new Date(comment.createdAt).toISOString(), comment.authorName ?? null);
  }

  listAgents(): AgentProfile[] {
    return (this.db.prepare('SELECT * FROM agents ORDER BY rowid').all() as unknown as AgentProfile[])
      .map(agent => ({ ...agent }));
  }

  saveAgent(input: unknown): AgentProfile {
    const agent = parseAgentProfile(input);
    this.db.prepare(`INSERT INTO agents (id, name, tool, model, effort, instructions, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, tool=excluded.tool, model=excluded.model, effort=excluded.effort,
      instructions=excluded.instructions, permissions=excluded.permissions`)
      .run(agent.id, agent.name, agent.tool, agent.model, agent.effort, agent.instructions, agent.permissions);
    return agent;
  }

  deleteAgent(id: string) {
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  }

  listColumnAgents(): ColumnAssignment[] {
    return (this.db.prepare('SELECT * FROM column_assignments ORDER BY rowid').all() as unknown as ColumnAssignment[])
      .map(assignment => ({ ...assignment }));
  }

  assignColumnAgent(input: unknown): ColumnAssignment | null {
    if (!input || typeof input !== 'object') throw new AgentValidationError('Choose a column and agent.');
    const { column, agentId } = input as { column: ColumnAssignment['column']; agentId: unknown };
    if (!this.listColumns().includes(column)) throw new AgentValidationError('Choose an existing board column.');
    if (agentId === null) {
      this.db.prepare('DELETE FROM column_assignments WHERE column = ?').run(column);
      return null;
    }
    if (typeof agentId !== 'string' || !this.db.prepare('SELECT id FROM agents WHERE id = ?').get(agentId)) {
      throw new AgentValidationError('Choose a saved agent from the Agents screen.');
    }
    this.db.prepare('INSERT INTO column_assignments (column, agentId) VALUES (?, ?) ON CONFLICT(column) DO UPDATE SET agentId=excluded.agentId')
      .run(column, agentId);
    return { column, agentId };
  }

  close() { this.db.close(); }
}
