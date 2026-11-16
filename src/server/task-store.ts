import { AgentValidationError, parseAgentProfile, type AgentProfile, type ColumnAssignment } from '../components/tasks/column-agent.ts';
import { processIdentity } from './process-identity.ts';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { statuses, type Task, type TaskComment } from '../components/tasks/task.ts';

export class PendingRunError extends Error {}

export type AgentRun = {
  id: string; taskId: string; column: Task['status']; profile: AgentProfile;
  status: 'Queued' | 'Running' | 'Complete' | 'Failed' | 'Interrupted';
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
      const runColumns = this.db.prepare('PRAGMA table_info(runs)').all();
      for (const column of ['ownerIdentity', 'runnerIdentity']) {
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

  list(): Task[] {
    return (this.db.prepare('SELECT * FROM tasks ORDER BY rowid').all() as unknown as Task[])
      .map(task => ({ ...task, comments: this.db.prepare('SELECT * FROM comments WHERE taskId = ? ORDER BY createdAt, rowid').all(task.id) as unknown as NonNullable<Task['comments']> }));
  }

  save(input: unknown): Task {
    if (!input || typeof input !== 'object') throw new Error('Invalid task.');
    const task = input as Task;
    if (typeof task.id !== 'string' || !task.id.trim() || typeof task.title !== 'string' || !task.title.trim() ||
        typeof task.description !== 'string' || !statuses.includes(task.status)) {
      throw new Error('Enter a title and valid task properties.');
    }
    return this.transaction(() => {
      const previous = this.list().find(item => item.id === task.id);
      if (previous && previous.status !== task.status) this.assertIdle(task.id);
      this.db.prepare(`INSERT INTO tasks (id, title, description, status) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
        status=excluded.status`).run(task.id, task.title.trim(), task.description, task.status);
      if (previous && previous.status !== task.status) {
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

  recordRunner(runId: string, pid: number) {
    this.db.prepare("UPDATE runs SET runnerPid = ?, runnerIdentity = ? WHERE id = ? AND status = 'Running'").run(pid, processIdentity(pid), runId);
  }

  finishRun(runId: string, status: 'Complete' | 'Failed' | 'Interrupted', summary: string) {
    this.transaction(() => {
      const run = this.history().find(run => run.id === runId && run.status === 'Running');
      if (!run) return;
      const finishedAt = new Date().toISOString();
      this.db.prepare('UPDATE runs SET status = ?, finishedAt = ?, summary = ? WHERE id = ?').run(status, finishedAt, summary, runId);
      this.db.prepare('UPDATE tasks SET agentStatus = ? WHERE id = ?').run(status, run.taskId);
      this.addComment({ id: randomUUID(), taskId: run.taskId, body: summary, createdAt: finishedAt });
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
      throw new PendingRunError('Wait for this agent run to finish before moving or deleting the task.');
    }
  }

  addComment(comment: TaskComment) {
    this.db.prepare('INSERT INTO comments (id, taskId, body, createdAt) VALUES (?, ?, ?, ?)')
      .run(comment.id, comment.taskId, comment.body, new Date(comment.createdAt).toISOString());
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
    if (!statuses.includes(column)) throw new AgentValidationError('Choose an existing board column.');
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
