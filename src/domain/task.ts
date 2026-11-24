import type { ArtifactReference } from "./artifact.ts";
export const statuses = ["To do", "In progress", "In review", "Done"] as const;
export type Status = string;
export const agentStatuses = [
  "Not started",
  "Queued",
  "Complete",
  "Failed",
  "Interrupted",
  "Stopped",
  "Running",
  "Paused",
  "Waiting",
  "Review",
  "Blocked",
] as const;
export type AgentStatus = (typeof agentStatuses)[number];
export type Board = { id: string; name: string; columns: string[] };
export type Task = {
  archivedAt?: string | null;
  creditUsage?: import("./usage.ts").TaskCreditUsage;
  /** Assigned by the database when the task is first saved. */
  taskNumber?: number;
  boardId?: string;
  id: string;
  title: string;
  description: string;
  status: Status;
  agentStatus: AgentStatus;
  autoWorkflow?: boolean;
  autoRun?: boolean;
  comments?: TaskComment[];
};

export type TaskComment = {
  memoryChanges?: import("./memory.ts").MemoryChange[];
  parentCommentId?: string | null;
  artifacts?: ArtifactReference[];
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  authorName?: string | null;
  authorRole?: "human" | "agent" | null;
  recommendation?: string | null;
  responseType?: "text" | "approval" | "memory" | null;
  feedbackStatus?: "pending" | "answered" | "cancelled" | null;
  runId?: string | null;
};
