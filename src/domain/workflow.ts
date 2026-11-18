import type { ArtifactReference } from "./artifact.ts";
import type { AgentProfile } from "./column-agent.ts";
import type { RunHistoryEntry } from "./execution.ts";

export type WorkflowStep = { id: string; instructions: string } & (
  | { kind?: "agent"; agentId: string }
  | { kind: "checkpoint"; agentId?: never }
  | { kind: "review"; agentId: string; revisionAgentId: string; revisionInstructions: string; maxRounds: number }
);
export type WorkflowStepSnapshot = WorkflowStep & { profile: AgentProfile | null; revisionProfile?: AgentProfile; review?: ReviewState };
export type StatusMappings = Partial<Record<"todo" | "inProgress" | "inReview" | "done", string | null>>;

export type Workflow = { id: string; name: string; statusMappings?: StatusMappings } & (
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

export type FindingUpdate = { id: string; body?: string; status: "outstanding" | "resolved"; note: string };
export type ReviewFinding = {
  id: string; body: string; status: "outstanding" | "resolved"; introducedRunId: string;
  dispositions: { runId: string; round: number; status: "outstanding" | "resolved"; note: string }[];
};

export type ReviewState = {
  findingRecords?: ReviewFinding[];
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
    findingUpdates?: FindingUpdate[];
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

export const milestoneLabels = { todo: "Ready", inProgress: "Working", inReview: "Human review", done: "Completed" } as const;
export function defaultStatusMappings(columns: readonly string[]): StatusMappings {
  return Object.fromEntries(Object.entries({ todo: "To do", inProgress: "In progress", inReview: "In review", done: "Done" }).filter(([, name]) => columns.includes(name)));
}

export function parseStatusMappings(input: unknown, columns: readonly string[]): StatusMappings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Choose valid status mappings.");
  for (const [key, column] of Object.entries(input)) {
    if (!Object.hasOwn(milestoneLabels, key) || (column !== null && (typeof column !== "string" || !columns.includes(column))))
      throw new Error(`Milestone ${key}: choose an existing status column or keep the current status.`);
  }
  return { ...input } as StatusMappings;
}
