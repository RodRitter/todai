import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TaskStore } from './task-store.ts';

test('column agent settings survive reopening without starting tasks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-agents-'));
  const path = join(directory, 'tasks.sqlite');
  let store = new TaskStore(path);
  try {
    const task = store.save({ id: 'one', title: 'Review work', description: '', status: 'In review' });
    assert.deepEqual(store.listColumnAgents(), []);
    store.saveColumnAgent({ column: 'In review', name: 'Reviewer', tool: 'codex', model: 'review-model', effort: 'high', instructions: 'Review the changes.', permissions: 'read-only' });
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listColumnAgents(), [{ column: 'In review', name: 'Reviewer', tool: 'codex', model: 'review-model', effort: 'high', instructions: 'Review the changes.', permissions: 'read-only' }]);
    assert.deepEqual(store.list(), [task]);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid settings explain what to fix and preserve the saved assignment', () => {
  const store = new TaskStore(':memory:');
  try {
    const saved = store.saveColumnAgent({ column: 'To do', name: 'Planner', tool: 'codex', model: 'planning-model', effort: 'medium', instructions: '', permissions: 'read-only' });
    for (const [change, message] of [
      [{ name: '  ' }, /agent name/i],
      [{ model: '' }, /model/i],
      [{ effort: 'extreme' }, /effort/i],
      [{ permissions: 'all' }, /permissions/i],
      [{ tool: 'other' }, /Codex CLI/i],
      [{ column: 'Unknown' }, /column/i],
      [{ instructions: null }, /instructions/i],
    ] as const) {
      assert.throws(() => store.saveColumnAgent({ ...saved, ...change }), message);
      assert.deepEqual(store.listColumnAgents(), [saved]);
    }
    assert.throws(() => store.saveColumnAgent(null), /settings/i);
  } finally { store.close(); }
});

test('editing one column preserves other assignments across a restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-agent-edit-'));
  const path = join(directory, 'tasks.sqlite');
  let store = new TaskStore(path);
  try {
    const planner = store.saveColumnAgent({ column: 'To do', name: 'Planner', tool: 'codex', model: 'planning-model', effort: 'medium', instructions: '', permissions: 'read-only' });
    store.saveColumnAgent({ ...planner, column: 'Done', name: 'Reporter' });
    const updated = store.saveColumnAgent({ ...planner, name: '  Architect  ', model: '  architecture-model ', effort: 'high', instructions: 'Plan the work.', permissions: 'workspace-write' });
    store.close();
    store = new TaskStore(path);
    assert.equal(updated.name, 'Architect');
    assert.equal(updated.model, 'architecture-model');
    assert.deepEqual(store.listColumnAgents(), [
      { ...planner, name: 'Architect', model: 'architecture-model', effort: 'high', instructions: 'Plan the work.', permissions: 'workspace-write' },
      { ...planner, column: 'Done', name: 'Reporter' },
    ]);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
