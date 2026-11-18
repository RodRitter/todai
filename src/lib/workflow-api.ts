import type { Workflow, WorkflowExecution } from "@/domain/workflow";
import { workspaceFetch } from "./workspace-fetch";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await workspaceFetch(url, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Could not load workflows.");
  return value;
}
export type WorkflowDefault = { workflowId: string | null; available: boolean };
export const workflowApi = {
  list: (signal: AbortSignal) => request<Workflow[]>("/api/workflows", { signal }),
  getDefault: (signal: AbortSignal) => request<WorkflowDefault>("/api/workflows/default", { signal }),
  setDefault: (workflowId: string | null) => request<WorkflowDefault>("/api/workflows/default", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflowId }) }),
  history: (taskId: string, signal: AbortSignal) => request<WorkflowExecution[]>(`/api/workflows?${new URLSearchParams({ taskId })}`, { signal }),
  retry: (taskId: string, executionId: string) => request<unknown>("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, executionId }) }),
  save: (workflow: Workflow) => request<Workflow>("/api/workflows", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workflow) }),
};
