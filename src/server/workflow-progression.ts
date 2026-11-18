import type { AgentProfile } from "../domain/column-agent.ts";
import type { Task } from "../domain/task.ts";
import type { AgentRun } from "./task-store.ts";

export type ProgressionContext = {
  event: "feedback-answered";
  task: Task;
  run: AgentRun;
} | {
  event: "run-finished";
  task: Task;
  run: AgentRun;
  columns: string[];
  hasQueuedRun: boolean;
  replyPlan?: AgentProfile[];
};
export type WorkflowProgression =
  | { action: "wait" }
  | {
      action: "queue";
      column: string;
      profile: AgentProfile;
      kind: AgentRun["kind"];
      commentId: AgentRun["commentId"];
      replyPlan: AgentRun["replyPlan"];
      createdAt: string;
    }
  | { action: "advance"; column: string; autoRun: boolean };

// Decide progression without changing execution history or dispatching an executor.
export function workflowProgression(context: ProgressionContext): WorkflowProgression {
  const { task, run } = context;
  if (context.event === "feedback-answered") {
    return { action: "queue", column: task.status, profile: run.profile, kind: run.kind, commentId: run.commentId, replyPlan: run.replyPlan, createdAt: run.createdAt };
  }
  const { columns, hasQueuedRun } = context;
  if (run.kind && (run.status === "Complete" || (run.status === "Failed" && run.kind === "reply"))) {
    const [next, ...rest] = context.replyPlan ?? run.replyPlan ?? [];
    if (next) return { action: "queue", column: run.column, profile: next, kind: "reply", commentId: run.commentId, replyPlan: rest, createdAt: run.createdAt };
  }
  if (run.status !== "Complete" || run.kind || hasQueuedRun || !task.autoWorkflow || task.status !== run.column)
    return { action: "wait" };
  const index = columns.indexOf(task.status);
  const column = index >= 0 ? columns[index + 1] : undefined;
  return column ? { action: "advance", column, autoRun: Boolean(task.autoRun) } : { action: "wait" };
}
