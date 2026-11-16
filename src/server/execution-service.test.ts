import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TaskStore } from './task-store.ts';
import { ExecutionService, type Runner } from './execution-service.ts';

const profile = { id: 'builder', name: 'Builder', tool: 'codex', model: 'test-model', effort: 'high', instructions: 'Build carefully', permissions: 'workspace-write' };
function fixture(runner: Runner) {
  const directory = mkdtempSync(join(tmpdir(), 'todai-execution-'));
  const store = new TaskStore(join(directory, 'tasks.sqlite'));
  store.saveAgent(profile);
  store.assignColumnAgent({ column: 'In progress', agentId: 'builder' });
  const service = new ExecutionService(store, runner, directory);
  return { store, service, directory, cleanup() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test('only a move to an assigned column queues a run, with a profile snapshot', async () => {
  const f = fixture(async () => 'Finished');
  try {
    const task = f.service.save({ id: 'one', title: 'Build', description: 'A board', status: 'To do' });
    assert.equal(f.service.history('one').length, 0);
    const moved = f.service.save({ ...task, status: 'In progress' });
    assert.equal(moved.agentStatus, 'Queued');
    f.service.save(moved);
    f.service.list();
    f.store.saveAgent({ ...profile, model: 'changed' });
    assert.equal(f.service.history('one').length, 1);
    assert.equal(f.service.history('one')[0].profile.model, 'test-model');
    const created = f.service.save({ id: 'two', title: 'New', description: '', status: 'In progress' });
    assert.equal(created.agentStatus, 'Not started');
    assert.equal(f.service.history('two').length, 0);
    await f.service.drain();
  } finally { f.cleanup(); }
});

test('runs are serialized across services and completion persists handovers without moving tasks', async () => {
  const started: string[] = [];
  let finish!: (summary: string) => void;
  const f = fixture(({ task }) => { started.push(task.id); return new Promise(resolve => { finish = resolve; }); });
  try {
    for (const id of ['one', 'two']) {
      const task = f.service.save({ id, title: id, description: '', status: 'To do' });
      f.service.save({ ...task, status: 'In progress' });
    }
    const draining = f.service.drain();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, ['one']);
    assert.deepEqual(f.service.list().map(task => task.agentStatus), ['Running', 'Queued']);
    const other = new ExecutionService(f.store, async () => { throw new Error('overlap'); }, f.directory);
    await other.drain();
    finish('Implemented the board');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, ['one', 'two']);
    finish('Reviewed the board');
    await draining;
    const reopened = new TaskStore(join(f.directory, 'tasks.sqlite'));
    try {
      assert.deepEqual(reopened.list().map(task => [task.status, task.agentStatus]), [['In progress', 'Complete'], ['In progress', 'Complete']]);
      assert.equal(reopened.list()[0].comments?.[0].body, 'Implemented the board');
      assert.equal(reopened.history('one')[0].summary, 'Implemented the board');
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test('failed launches release the queue and later loops receive earlier handovers', async () => {
  const contexts: string[][] = [];
  const f = fixture(async ({ task }) => {
    if (task.id === 'bad') throw new Error('Codex executable was not found');
    contexts.push(task.comments?.map(comment => comment.body) ?? []);
    return 'Ready for review';
  });
  try {
    for (const id of ['bad', 'good']) {
      const task = f.service.save({ id, title: id, description: 'Task details', status: 'To do' });
      f.service.save({ ...task, status: 'In progress' });
    }
    await f.service.drain();
    assert.equal(f.service.list()[0].agentStatus, 'Failed');
    assert.match(f.service.history('bad')[0].summary!, /Codex executable was not found/);
    f.store.assignColumnAgent({ column: 'In review', agentId: 'builder' });
    f.service.save({ ...f.service.list()[1], status: 'In review' });
    await f.service.drain();
    assert.deepEqual(contexts, [[], ['Ready for review']]);
    assert.equal(f.service.history('good').length, 2);
    assert.equal(f.service.list()[1].status, 'In review');
  } finally { f.cleanup(); }
});

test('pending tasks cannot move or disappear until execution ends', async () => {
  const f = fixture(async () => 'Done');
  try {
    const task = f.service.save({ id: 'one', title: 'Build', description: '', status: 'To do' });
    const queued = f.service.save({ ...task, status: 'In progress' });
    assert.throws(() => f.service.save({ ...queued, status: 'Done' }), /Wait for/);
    assert.throws(() => f.service.delete(task.id), /Wait for/);
    assert.equal(f.service.list()[0].status, 'In progress');
    await f.service.drain();
    f.service.save({ ...queued, status: 'Done' });
    f.service.delete(task.id);
    assert.deepEqual(f.service.list(), []);
  } finally { f.cleanup(); }
});

test('restart surfaces an abandoned run, resumes queued work, and never reruns completed work', async () => {
  const { spawnSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const executed: string[] = [];
  const f = fixture(async ({ task }) => { executed.push(task.id); return 'Finished once'; });
  try {
    for (const id of ['abandoned', 'waiting']) {
      const task = f.service.save({ id, title: id, description: '', status: 'To do' });
      f.service.save({ ...task, status: 'In progress' });
    }
    const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `
      import { spawn } from 'node:child_process';
      import { TaskStore } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/server/task-store.ts')).href)};
      import { ExecutionService } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/server/execution-service.ts')).href)};
      const store = new TaskStore(${JSON.stringify(join(f.directory, 'tasks.sqlite'))});
      const service = new ExecutionService(store, async ({ onStart }) => {
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
        onStart(child.pid);
        child.unref();
        process.exit(0);
      }, ${JSON.stringify(f.directory)});
      await service.drain();
    `]);
    assert.equal(child.status, 0, child.stderr.toString());
    assert.equal(f.service.list()[0].agentStatus, 'Running');
    const orphanPid = f.service.history('abandoned')[0].runnerPid!;
    assert.doesNotThrow(() => process.kill(orphanPid, 0));
    await f.service.drain();
    assert.equal(f.service.list()[0].agentStatus, 'Interrupted');
    assert.throws(() => process.kill(orphanPid, 0));
    assert.match(f.service.list()[0].comments![0].body, /restart|stopped/);
    assert.deepEqual(executed, ['waiting']);
    const restarted = new ExecutionService(f.store, async () => { throw new Error('must not rerun'); }, f.directory);
    await restarted.drain();
    assert.equal(restarted.list()[1].agentStatus, 'Complete');
  } finally { f.cleanup(); }
});

test('restart does not treat a reused owner PID as the original app process', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const f = fixture(async () => 'Should not rerun');
  try {
    const task = f.service.save({ id: 'stale', title: 'Old work', description: '', status: 'To do' });
    f.service.save({ ...task, status: 'In progress' });
    // Model an archived database whose original owner PID now belongs to this test process.
    const archived = new DatabaseSync(join(f.directory, 'tasks.sqlite'));
    archived.prepare("UPDATE runs SET status = 'Running', ownerPid = ?, ownerIdentity = 'previous process start time', runnerPid = ?, runnerIdentity = 'previous process start time' WHERE taskId = 'stale'").run(process.pid, process.pid);
    archived.close();
    await f.service.drain();
    assert.equal(f.service.history('stale')[0].status, 'Interrupted');
  } finally { f.cleanup(); }
});
