import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TaskStore } from './task-store.ts';

test('create, edit, move and delete survive reopening SQLite', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-test-'));
  const path = join(directory, 'tasks.sqlite');
  let store = new TaskStore(path);
  try {
    const task = store.save({ id: 'one', title: 'Build board', description: 'Persist work', status: 'To do' });
    assert.equal(task.agentStatus, 'Not started');
    store.close();
    store = new TaskStore(path);
    assert.equal(store.list()[0].description, 'Persist work');
    store.save({ ...task, title: 'Saved board', status: 'Done' });
    store.close();
    store = new TaskStore(path);
    assert.equal(store.list()[0].title, 'Saved board');
    assert.equal(store.list()[0].status, 'Done');
    assert.equal(store.list()[0].agentStatus, 'Not started');
    store.delete('one');
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.list(), []);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('comments stay with their task in chronological order after reopening', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-comments-'));
  const path = join(directory, 'tasks.sqlite');
  let store = new TaskStore(path);
  try {
    for (const id of ['one', 'two']) store.save({ id, title: id, description: '', status: 'To do' });
    store.addComment({ id: 'later', taskId: 'one', body: 'Finished', createdAt: '2026-11-16T12:00:00Z' });
    store.addComment({ id: 'earlier', taskId: 'one', body: 'Started', createdAt: '2026-11-16T11:00:00Z' });
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.list()[0].comments?.map(comment => comment.body), ['Started', 'Finished']);
    assert.deepEqual(store.list()[1].comments, []);
    store.delete('one');
    store.save({ id: 'one', title: 'New task', description: '', status: 'To do' });
    assert.deepEqual(store.list().find(task => task.id === 'one')?.comments, []);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('existing tasks and comments survive removing legacy task assignees', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const directory = mkdtempSync(join(tmpdir(), 'todai-legacy-'));
  const path = join(directory, 'tasks.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL, owner TEXT NOT NULL, agentStatus TEXT NOT NULL DEFAULT 'Not started');
    CREATE TABLE comments (id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      body TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO tasks VALUES ('legacy', 'Existing task', 'Keep this', 'In review', 'Reviewer', 'Not started');
    INSERT INTO comments VALUES ('handover', 'legacy', 'Existing handover', '2026-11-16T12:00:00.000Z');
  `);
  legacy.close();
  const store = new TaskStore(path);
  try {
    const task = store.list()[0];
    assert.equal('owner' in task, false);
    assert.equal(task.status, 'In review');
    assert.equal(task.comments?.[0].body, 'Existing handover');
    store.save({ ...task, title: 'Updated task' });
    store.save({ id: 'new', title: 'New task', description: '', status: 'To do' });
    assert.deepEqual(store.list().map(task => task.title), ['Updated task', 'New task']);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
