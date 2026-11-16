import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { TaskStore } from './task-store.ts';
import { ExecutionService } from './execution-service.ts';
import { executionWorkspace, suggestDirectories, validateWorkspace, workspacePath } from './workspace-settings.ts';

test('workspace selection persists, validates directories, and ignores the retired environment variable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-workspace-'));
  const path = join(directory, 'tasks.sqlite');
  let store = new TaskStore(path);
  const previous = process.env.TODAI_WORKSPACE_PATH;
  try {
    process.env.TODAI_WORKSPACE_PATH = '/unused-workspace';
    assert.equal(workspacePath(store), resolve('workspace'));
    mkdirSync(join(directory, 'project'));
    writeFileSync(join(directory, 'file'), 'text');
    const selected = validateWorkspace(join(directory, 'project'));
    store.setWorkspacePath(selected);
    store.close();
    store = new TaskStore(path);
    assert.equal(executionWorkspace(store), selected);
    assert.equal(validateWorkspace('~'), validateWorkspace(homedir()));
    for (const invalid of ['', null, join(directory, 'missing'), join(directory, 'file')]) {
      assert.throws(() => validateWorkspace(invalid), /directory/);
    }
    assert.equal(workspacePath(store), selected);
  } finally {
    if (previous === undefined) delete process.env.TODAI_WORKSPACE_PATH;
    else process.env.TODAI_WORKSPACE_PATH = previous;
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('directory autocomplete filters files, handles spaces and symlinks, and browses children', () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-directories-'));
  try {
    mkdirSync(join(directory, 'project one', 'nested'), { recursive: true });
    mkdirSync(join(directory, 'project two'));
    writeFileSync(join(directory, 'project file'), 'text');
    symlinkSync(join(directory, 'project one'), join(directory, 'project link'));
    symlinkSync(join(directory, 'missing'), join(directory, 'project broken'));
    assert.deepEqual(suggestDirectories(`${directory}/project`), ['project link', 'project one', 'project two'].map(name => `${directory}/${name}/`));
    assert.deepEqual(suggestDirectories(`${directory}/project one/`), [`${directory}/project one/nested/`]);
    assert.throws(() => suggestDirectories(`${directory}/missing/`), /Could not read/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('workspace changes apply to queued runs without changing the active run directory', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'todai-workspace-runs-'));
  const store = new TaskStore(join(directory, 'tasks.sqlite'));
  let finish!: () => void;
  const seen: string[] = [];
  let draining: Promise<void> | undefined;
  try {
    for (const name of ['first', 'second']) mkdirSync(join(directory, name));
    const first = validateWorkspace(join(directory, 'first'));
    const second = validateWorkspace(join(directory, 'second'));
    store.setWorkspacePath(first);
    store.saveAgent({ id: 'agent', name: 'Agent', tool: 'codex', model: 'test', effort: 'medium', instructions: '', permissions: 'workspace-write' });
    store.assignColumnAgent({ column: 'To do', agentId: 'agent' });
    for (const id of ['one', 'two']) store.save({ id, title: id, description: '', status: 'To do' });
    const service = new ExecutionService(store, async ({ workspace }) => {
      seen.push(workspace);
      if (seen.length === 1) await new Promise<void>(resolve => { finish = resolve; });
      return 'Finished';
    }, () => executionWorkspace(store));
    draining = service.drain();
    store.setWorkspacePath(second);
    assert.deepEqual(seen, [first]);
    finish();
    await draining;
    assert.deepEqual(seen, [first, second]);
  } finally { finish?.(); await draining; store.close(); rmSync(directory, { recursive: true, force: true }); }
});
