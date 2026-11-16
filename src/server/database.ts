import { join } from 'node:path';
import { TaskStore } from './task-store';

export function withTaskStore<T>(operation: (store: TaskStore) => T): T {
  const store = new TaskStore(process.env.TODAI_DB_PATH ?? join(process.cwd(), '.todai', 'tasks.sqlite'));
  try { return operation(store); } finally { store.close(); }
}
