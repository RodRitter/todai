import type { ArtifactReference } from "@/domain/artifact";
import type { Workspace } from "../domain/workspace.ts";
import { workspaceFetch } from "./workspace-fetch.ts";
import type { AgentProfile, ColumnAssignment, ExecutionTool, ExecutorSettingsData } from "@/domain/column-agent";
import type { Task } from "@/domain/task";

export type BoardSnapshot = {
  worktreesEnabled?: boolean;
  tasks: Task[];
  columns: string[];
  columnInstructions?: Record<string, string>;
  completionColumn?: string | null;
  assignments: ColumnAssignment[];
};

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(
  url: string,
  { body, ...options }: RequestOptions = {},
  fallback = "Could not save changes. Try again.",
): Promise<T> {
  const response = await workspaceFetch(url, {
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
  retryWorktree: (taskId: string) =>
    request<Task>("/api/tasks/worktree", { method: "POST", body: { taskId } }),
  reset: (taskId: string) =>
    request<Task>("/api/tasks/reset", { method: "POST", body: { taskId } }),
  stop: (taskId: string) =>
    request<Task>("/api/tasks/stop", { method: "POST", body: { taskId } }),
  run: (taskId: string) =>
    request<Task>("/api/tasks/run", { method: "POST", body: { taskId } }),
  deleteComment: (taskId: string, commentId: string) =>
    request<Task>("/api/tasks/comments", { method: "DELETE", body: { taskId, commentId } }),
  postComment: (taskId: string, body: string, artifacts?: ArtifactReference[], parentCommentId?: string) =>
    request<Task>("/api/tasks/comments", { method: "POST", body: { taskId, body, artifacts, parentCommentId } }),
  answerFeedback: (taskId: string, commentId: string, body: string) =>
    request<Task>("/api/tasks/feedback", { method: "POST", body: { taskId, commentId, body } }),
  list: () => request<BoardSnapshot>("/api/tasks?workspace=true"),
  save: (task: Task) =>
    request<Task>("/api/tasks", { method: "PUT", body: task }),
  delete: (id: string) =>
    request<void>(`/api/tasks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export const agentApi = {
  assignments: () => request<(ColumnAssignment & { boardName?: string })[]>("/api/column-agents?allBoards=true"),
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
  rename: (column: string, name: string, instructions?: string, completion?: boolean) =>
    request<string[]>("/api/columns", {
      method: "PATCH",
      body: { column, name, ...(instructions !== undefined ? { instructions } : {}), ...(completion !== undefined ? { completion } : {}) },
    }),
  remove: (column: string) =>
    request<string[]>("/api/columns", { method: "DELETE", body: column }),
  reorder: (columns: string[]) =>
    request<string[]>("/api/columns", { method: "PUT", body: columns }),
};

const settingsError = "Could not load workspace settings.";
export const executorApi = {
  get: (status = false) => request<ExecutorSettingsData>(`/api/executors?status=${status}`),
  save: (defaultExecutor: ExecutionTool) => request<ExecutorSettingsData>("/api/executors", { method: "PUT", body: { defaultExecutor } }),
  test: async (tool: ExecutionTool = "codex") => {
    try {
      return await request<{ message: string }>(
        `/api/executor-test?tool=${tool}`,
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
  archived: () => request<Workspace[]>("/api/workspaces?archived=true"),
  setArchived: (id: string, archived: boolean) => request<{ workspaces: Workspace[]; archived: Workspace[] }>("/api/workspaces", { method: "PATCH", body: { id, archived } }),
  create: (name: string, path: string, setup?: import("@/domain/workspace-setup").WorkspaceSetup) => request<Workspace>("/api/workspaces", { method: "POST", body: { name, path, ...setup } }),
  get: () => request<{ path: string; worktreesEnabled: boolean }>("/api/workspace", {}, settingsError),
  saveWorktrees: (worktreesEnabled: boolean) => request<{ worktreesEnabled: boolean }>("/api/workspace", { method: "PATCH", body: { worktreesEnabled } }),
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

export const jiraImportApi = {
  import: (url: string, agentId: string) => request<import("@/domain/jira-import").JiraTicketDraft>("/api/jira-import", { method: "POST", body: { url, agentId } }),
};

export const boardApi = {
  reorder: (ids: string[]) => request<import("@/domain/task").Board[]>("/api/boards", { method: "PUT", body: ids }),
  list: () => request<import("@/domain/task").Board[]>("/api/boards"),
  create: (name: string, description?: string) => request<import("@/domain/task").Board>("/api/boards", { method: "POST", body: { name, description } }),
  rename: (id: string, name: string, description?: string) => request<import("@/domain/task").Board>("/api/boards", { method: "PATCH", body: { id, name, description } }),
  remove: (id: string) => request<void>("/api/boards", { method: "DELETE", body: { id } }),
};

// Settings navigation is local; each editor keeps its own board scope.
export function boardSettingsApi(boardId: string) {
  const headers = { "X-Todai-Board": boardId };
  return {
    load: () => request<BoardSnapshot>("/api/tasks?workspace=true", { headers }),
    create: (name: string) => request<string[]>("/api/columns", { headers, method: "POST", body: name }),
    rename: (column: string, name: string, instructions?: string, completion?: boolean) => request<string[]>("/api/columns", { headers, method: "PATCH", body: { column, name, ...(instructions !== undefined ? { instructions } : {}), ...(completion !== undefined ? { completion } : {}) } }),
    remove: (column: string) => request<string[]>("/api/columns", { headers, method: "DELETE", body: column }),
    reorder: (columns: string[]) => request<string[]>("/api/columns", { headers, method: "PUT", body: columns }),
  };
}

export const generalSettingsApi = {
  get: () => request<{ userName: string }>("/api/general-settings"),
  setCreditLimit: (creditLimit: number) => request<{ creditLimit: number }>("/api/credit-limit", { method: "PUT", body: { creditLimit } }),
  save: (userName: string) => request<{ userName: string }>("/api/general-settings", { method: "PUT", body: { userName } }),
};


export const memoryApi = {
  change: (change: unknown) => request<{ changed: boolean }>("/api/memory", { method: "PATCH", body: change }),
  history: (id: string) => request<{ entry: import("@/domain/memory").MemoryEntry; reason: string }[]>(`/api/memory?view=history&id=${encodeURIComponent(id)}`),
  clear: () => request<{ cleared: number }>("/api/memory", { method: "DELETE", body: { confirmation: "clear-memory" } }, "Could not clear workspace memory. Try again."),
  search: (query = "", offset = 0, signal?: AbortSignal, retired = false) => request<import("@/domain/memory").MemorySearchResult>(`/api/memory?view=entries&query=${encodeURIComponent(query)}&offset=${offset}&retired=${retired}`, { signal }, "Could not load workspace memory. Try again."),
  get: (signal?: AbortSignal) => request<import("@/domain/memory").MemorySnapshot>("/api/memory", { signal }, "Could not load workspace memory. Try again."),
};
