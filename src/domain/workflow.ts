import type { ArtifactReference } from "./artifact.ts";
import type { AgentProfile } from "./column-agent.ts";
import type { RunHistoryEntry } from "./execution.ts";

export type WorkflowStep = { id: string; instructions: string } & (
  | { kind?: "agent"; agentId: string }
  | { kind: "checkpoint"; agentId?: never }
  | { kind: "review"; agentId: string; revisionAgentId: string; revisionInstructions: string; maxRounds: number }
);
export type WorkflowStepSnapshot = WorkflowStep & { profile: AgentProfile | null; revisionProfile?: AgentProfile; review?: ReviewState };
export type Workflow = { id: string; name: string } & (
  | { steps: WorkflowStep[]; agentId?: never; instructions?: never }
  | { steps?: undefined; agentId: string; instructions: string }
);

// Existing single-step definitions and snapshots retain their original identity.
export function workflowSteps(workflow: Workflow): WorkflowStep[] {
  return workflow.steps ?? [{ id: `${workflow.id}:agent`, agentId: workflow.agentId, instructions: workflow.instructions }];
}

export type WorkflowExecution = {
  id: string;
  taskId: string;
  stepId: string;
  workflow: Workflow;
  profile: AgentProfile | null;
  createdAt: string;
  status: RunHistoryEntry["status"];
  steps?: (WorkflowStepSnapshot & { status: RunHistoryEntry["status"] | "Not started" })[];
  runs: (RunHistoryEntry & { stepId?: string; prompt: string | null })[];
};

export type ReviewState = {
  phase: "review" | "revise" | "intervention" | "complete";
  round: number;
  limit: number;
  findings: string;
  attempts: {
    runId: string;
    role: "review" | "revise";
    round: number;
    reviewedRunId?: string;
    outcome?: "approved" | "changes-requested" | "invalid";
    findings?: string;
    artifacts?: ArtifactReference[];
    reviewedArtifacts?: ArtifactReference[];
  }[];
};

export const reviewPhaseLabels: Record<ReviewState["phase"], string> = {
  review: "Review",
  revise: "Revision",
  intervention: "Human intervention needed",
  complete: "Approved",
};
