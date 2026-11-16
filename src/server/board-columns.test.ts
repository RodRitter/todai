import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TaskStore } from './task-store.ts';

test('created columns and their order survive reopening without resetting defaults', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-columns-'));
  const path = join(directory, 'tasks.sqlite');
  let store = new TaskStore(path);
  try {
    assert.deepEqual(store.listColumns(), ['To do', 'In progress', 'In review', 'Done']);
    store.createColumn('  Planning  ');
    store.reorderColumns(['Planning', 'Done', 'To do', 'In progress', 'In review']);
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listColumns(), ['Planning', 'Done', 'To do', 'In progress', 'In review']);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('custom columns accept tasks and agents, and reordering preserves their work', () => {
  const store = new TaskStore(':memory:');
  try {
    store.createColumn('Planning');
    const agent = store.saveAgent({ id: 'planner', name: 'Planner', tool: 'codex', model: 'custom-model', effort: 'medium', instructions: '', permissions: 'read-only' });
    store.assignColumnAgent({ column: 'Planning', agentId: agent.id });
    const task = store.save({ id: 'one', title: 'Plan work', description: '', status: 'Planning' });
    assert.equal(task.agentStatus, 'Queued');
    store.reorderColumns(['Planning', 'To do', 'In progress', 'In review', 'Done']);
    assert.deepEqual(store.list(), [task]);
    assert.deepEqual(store.listColumnAgents(), [{ column: 'Planning', agentId: 'planner' }]);
    assert.equal(store.history().length, 1);
    assert.equal(store.history()[0].column, 'Planning');
    assert.throws(() => store.save({ ...task, status: 'Missing' }), /valid task/);
  } finally { store.close(); }
});

test('invalid names and stale or incomplete reorders leave columns intact', () => {
  const store = new TaskStore(':memory:');
  try {
    for (const name of ['', '  ', null, 'to DO', 'x'.repeat(81)]) {
      assert.throws(() => store.createColumn(name), /column|name/i);
    }
    store.createColumn('Planning');
    for (const order of [null, [], ['To do', 'In progress', 'In review', 'Done'],
      ['To do', 'In progress', 'In review', 'Done', 'Done'],
      ['To do', 'In progress', 'In review', 'Done', 'Unknown']]) {
      assert.throws(() => store.reorderColumns(order), /every existing column/);
      assert.deepEqual(store.listColumns(), ['To do', 'In progress', 'In review', 'Done', 'Planning']);
    }
  } finally { store.close(); }
});
