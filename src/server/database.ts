import { resolve } from "node:path";
import { TaskStore, WorkspaceOwnershipError } from "./task-store.ts";

// An omitted ID is reserved for server bootstrap and scheduler discovery.
export function openTaskStore(workspaceId?: string, boardId?: string) {
  return new TaskStore(resolve(process.env.TODAI_DB_PATH ?? ".todai/tasks.sqlite"), workspaceId, { seedWorkspace: false, boardId });
}

export function withTaskStore<T>(request: Request, operation: (store: TaskStore) => T): T {
  const workspaceId = request.headers.get("X-Todai-Workspace");
  if (!workspaceId) throw new WorkspaceOwnershipError("A workspace ID is required. Reload the page.");
  const store = openTaskStore(workspaceId, request.headers.get("X-Todai-Board") ?? undefined);
  try {
    return operation(store);
  } finally {
    store.close();
  }
}

// Task IDs are globally unique. Resolve the owner before reading through a scoped store.
export function resolveTaskReference(id: string) {
  const root = openTaskStore();
  const workspaces = (() => { try { return root.listWorkspaces(); } finally { root.close(); } })();
  for (const workspace of workspaces) {
    const store = openTaskStore(workspace.id);
    try {
      const task = store.list(true, id)[0];
      if (task) return { task, workspace };
    } finally { store.close(); }
  }
  return null;
}
