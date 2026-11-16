import { resolve } from "node:path";
import { TaskStore } from "./task-store";

export function openTaskStore() {
  return new TaskStore(
    resolve(process.env.TODAI_DB_PATH ?? ".todai/tasks.sqlite"),
  );
}

export function withTaskStore<T>(operation: (store: TaskStore) => T): T {
  const store = openTaskStore();
  try {
    return operation(store);
  } finally {
    store.close();
  }
}
