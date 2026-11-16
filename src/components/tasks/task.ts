export const statuses = ["To do", "In progress", "In review", "Done"] as const;
export type Status = (typeof statuses)[number];
export const agentStatuses = ["Not started", "Running", "Paused", "Review", "Blocked"] as const;
export type AgentStatus = (typeof agentStatuses)[number];
export const agentOwners = ["Developer", "Reviewer", "Planner", "Writer"] as const;
export type AgentOwner = (typeof agentOwners)[number];
export const agentStatusColors: Record<AgentStatus, string> = {
  "Not started": "text-muted-foreground",
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
  owner: AgentOwner;
  comments?: TaskComment[];
};


export type TaskComment = { id: string; taskId: string; body: string; createdAt: string };
