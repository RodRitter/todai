import { resolve } from "node:path";
import { TaskStore, WorkspaceOwnershipError } from "./task-store.ts";

// An omitted ID is reserved for server bootstrap and scheduler discovery.
export function openTaskStore(workspaceId?: string) {
  return new TaskStore(resolve(process.env.TODAI_DB_PATH ?? ".todai/tasks.sqlite"), workspaceId);
}

export function withTaskStore<T>(request: Request, operation: (store: TaskStore) => T): T {
  const workspaceId = request.headers.get("X-Todai-Workspace");
  if (!workspaceId) throw new WorkspaceOwnershipError("A workspace ID is required. Reload the page.");
  const store = openTaskStore(workspaceId);
  try {
    return operation(store);
  } finally {
    store.close();
  }
}
