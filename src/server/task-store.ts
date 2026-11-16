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

  close() { this.db.close(); }
}
