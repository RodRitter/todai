import type { AgentProfile, ColumnAssignment } from "@/domain/column-agent";
import type { Task } from "@/domain/task";

export type BoardSnapshot = {
  tasks: Task[];
  columns: string[];
  assignments: ColumnAssignment[];
};

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(
  url: string,
  { body, ...options }: RequestOptions = {},
  fallback = "Could not save changes. Try again.",
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error ?? fallback);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const taskApi = {
  list: () => request<BoardSnapshot>("/api/tasks?workspace=true"),
  save: (task: Task) =>
    request<Task>("/api/tasks", { method: "PUT", body: task }),
  delete: (id: string) =>
    request<void>(`/api/tasks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export const agentApi = {
  list: () => request<AgentProfile[]>("/api/agents"),
  save: (agent: AgentProfile) =>
    request<AgentProfile>("/api/agents", { method: "PUT", body: agent }),
  delete: (id: string) =>
    request<void>(`/api/agents?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  assign: (column: string, agentId: string | null) =>
    request<ColumnAssignment | null>("/api/column-agents", {
      method: "PUT",
      body: { column, agentId },
    }),
};

export const columnApi = {
  create: (name: string) =>
    request<string[]>("/api/columns", { method: "POST", body: name }),
  rename: (column: string, name: string) =>
    request<string[]>("/api/columns", {
      method: "PATCH",
      body: { column, name },
    }),
  remove: (column: string) =>
    request<string[]>("/api/columns", { method: "DELETE", body: column }),
  reorder: (columns: string[]) =>
    request<string[]>("/api/columns", { method: "PUT", body: columns }),
};

const settingsError = "Could not load workspace settings.";
export const executorApi = {
  test: async () => {
    try {
      return await request<{ message: string }>(
        "/api/executor-test",
        { method: "POST" },
        "Executor test failed. Check the app server logs and retry.",
      );
    } catch (error) {
      if (error instanceof TypeError || error instanceof SyntaxError)
        throw new Error("Could not reach the executor test or read its response. Check that the app server is running, then retry.");
      throw error;
    }
  },
};
export const workspaceApi = {
  get: () => request<{ path: string }>("/api/workspace", {}, settingsError),
  save: (path: string) =>
    request<{ path: string }>(
      "/api/workspace",
      { method: "PUT", body: path },
      settingsError,
    ),
  directories: (path: string, signal: AbortSignal) =>
    request<string[]>(
      `/api/directories?path=${encodeURIComponent(path)}`,
      { signal },
      settingsError,
    ),
};

export const configurationApi = {
  get: () => request<import("@/domain/configuration").Configuration>("/api/configuration"),
  import: (data: import("@/domain/configuration").Configuration, columnMode: "add" | "replace" = "add", conflictMode: "copy" | "overwrite" = "copy") =>
    request<{ agents: number; columns: number; assignments: number }>(`/api/configuration?columns=${columnMode}&conflicts=${conflictMode}`, { method: "POST", body: data }),
};
