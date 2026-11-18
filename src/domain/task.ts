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
export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  agentStatus: AgentStatus;
  workflowId?: string | null;
  workflowProgress?: { step: number; total: number; round: number; limit: number; phase: "review" | "revise" | "intervention" | "complete" };
  autoWorkflow?: boolean;
  autoRun?: boolean;
  comments?: TaskComment[];
};

export type FeedbackDecision = "approve" | "changes-requested" | "additional-round" | "stop";

export type TaskComment = {
  artifacts?: ArtifactReference[];
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  authorName?: string | null;
  recommendation?: string | null;
  feedbackStatus?: "pending" | "answered" | "cancelled" | null;
  runId?: string | null;
  feedbackKind?: "checkpoint" | "review-limit" | null;
  workflowExecutionId?: string | null;
  stepId?: string | null;
  evidenceCommentId?: string | null;
  responseTo?: string | null;
  decision?: FeedbackDecision | null;
};

export function isWorkflowHistoryComment(comment: TaskComment, comments: TaskComment[]): boolean {
  return Boolean(comment.workflowExecutionId && (comment.feedbackStatus || comment.responseTo)) ||
    comments.some((request) => request.evidenceCommentId === comment.id);
}
