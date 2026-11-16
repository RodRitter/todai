export const statuses = ["To do", "In progress", "In review", "Done"] as const;
export type Status = string;
export const agentStatuses = ["Not started", "Queued", "Complete", "Failed", "Interrupted", "Running", "Paused", "Review", "Blocked"] as const;
export type AgentStatus = (typeof agentStatuses)[number];
export const agentStatusColors: Record<AgentStatus, string> = {
  "Not started": "text-muted-foreground",
  Queued: "text-amber-600 dark:text-amber-400",
  Complete: "text-emerald-600 dark:text-emerald-400",
  Failed: "text-red-600 dark:text-red-400",
  Interrupted: "text-amber-600 dark:text-amber-400",
  Running: "text-emerald-600 dark:text-emerald-400",
  Paused: "text-amber-600 dark:text-amber-400",
  Review: "text-blue-600 dark:text-blue-400",
  Blocked: "text-red-600 dark:text-red-400",
};
export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  agentStatus: AgentStatus;
  autoWorkflow?: boolean;
  comments?: TaskComment[];
};


export type TaskComment = { id: string; taskId: string; body: string; createdAt: string; authorName?: string | null };
