export const statuses = ["To do", "In progress", "In review", "Done"] as const;
export type Status = string;
export const agentStatuses = [
  "Not started",
  "Queued",
  "Complete",
  "Failed",
  "Interrupted",
  "Running",
  "Paused",
  "Waiting",
  "Review",
  "Blocked",
] as const;
export type AgentStatus = (typeof agentStatuses)[number];
export type Task = {
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
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  authorName?: string | null;
  recommendation?: string | null;
  feedbackStatus?: "pending" | "answered" | "cancelled" | null;
  runId?: string | null;
};
