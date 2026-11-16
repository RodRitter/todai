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
    const task = store.save({ id: 'one', title: 'Build board', description: 'Persist work', status: 'To do', owner: 'Developer' });
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
    for (const id of ['one', 'two']) store.save({ id, title: id, description: '', status: 'To do', owner: 'Developer' });
    store.addComment({ id: 'later', taskId: 'one', body: 'Finished', createdAt: '2026-11-16T12:00:00Z' });
    store.addComment({ id: 'earlier', taskId: 'one', body: 'Started', createdAt: '2026-11-16T11:00:00Z' });
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.list()[0].comments?.map(comment => comment.body), ['Started', 'Finished']);
    assert.deepEqual(store.list()[1].comments, []);
    store.delete('one');
    store.save({ id: 'one', title: 'New task', description: '', status: 'To do', owner: 'Developer' });
    assert.deepEqual(store.list().find(task => task.id === 'one')?.comments, []);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
