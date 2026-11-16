import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { TaskStore } from './task-store';
import { ExecutionService } from './execution-service';
import { createCodexRunner } from './codex-runner';

// Keep one scheduler across Next.js development reloads. SQLite claims also serialize server processes.
const state = globalThis as typeof globalThis & { todaiExecution?: ExecutionService };
export function execution() {
  if (!state.todaiExecution) {
    const workspace = resolve(process.env.TODAI_WORKSPACE_PATH ?? 'workspace');
    mkdirSync(workspace, { recursive: true });
    const store = new TaskStore(resolve(process.env.TODAI_DB_PATH ?? '.todai/tasks.sqlite'));
    const service = new ExecutionService(store, createCodexRunner(), workspace);
    state.todaiExecution = service;
    let draining = false;
    const tick = async () => {
      if (draining) return;
      draining = true;
      try { await service.drain(); }
      catch (error) { console.error('Could not advance the agent queue:', error); }
      finally { draining = false; }
    };
    setInterval(() => { void tick(); }, 1000).unref();
    void tick();
  }
  return state.todaiExecution;
}
