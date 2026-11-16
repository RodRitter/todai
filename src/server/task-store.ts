import { AgentValidationError, parseAgentProfile, type AgentProfile, type ColumnAssignment } from '../components/tasks/column-agent.ts';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { statuses, type Task, type TaskComment } from '../components/tasks/task.ts';

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
    try {
      this.db.exec('BEGIN IMMEDIATE');
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
    this.db.prepare(`INSERT INTO tasks (id, title, description, status) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
      status=excluded.status`).run(task.id, task.title.trim(), task.description, task.status);
    return this.list().find(item => item.id === task.id)!;
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
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
