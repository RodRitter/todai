import { executionWorkspace } from './workspace-settings';
import { resolve } from 'node:path';
import { TaskStore } from './task-store';
import { ExecutionService } from './execution-service';
import { createCodexRunner } from './codex-runner';

type Scheduler = { run: () => Promise<void>; tick: () => void };
const state = globalThis as typeof globalThis & {
  todaiScheduler?: Scheduler;
  todaiExecution?: ExecutionService;
};

async function drainWorkspace() {
  const store = new TaskStore(resolve(process.env.TODAI_DB_PATH ?? '.todai/tasks.sqlite'));
  try { await new ExecutionService(store, createCodexRunner(), () => executionWorkspace(store)).drain(); }
  finally { store.close(); }
}

export function execution() {
  if (!state.todaiScheduler) {
    // Retire the old development singleton's timer callback without interrupting an active run.
    if (state.todaiExecution) {
      state.todaiExecution.drain = async () => {};
      delete state.todaiExecution;
    }
    let draining = false;
    const scheduler: Scheduler = {
      run: drainWorkspace,
      tick: () => {
        if (draining) return;
        draining = true;
        void Promise.resolve().then(() => scheduler.run())
          .catch(error => console.error('Could not advance the agent queue:', error))
          .finally(() => { draining = false; });
      },
    };
    state.todaiScheduler = scheduler;
    setInterval(scheduler.tick, 1000).unref();
  }
  // Keep only the timer across reloads, and refresh the implementation it invokes.
  state.todaiScheduler.run = drainWorkspace;
  state.todaiScheduler.tick();
}
