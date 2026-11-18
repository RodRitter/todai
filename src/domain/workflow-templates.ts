import { defaultStatusMappings, type Workflow, type WorkflowStep } from "./workflow.ts";

export const workflowTemplates = {
  single: "Single agent",
  "implement-review": "Implement and review",
  "plan-implement-review": "Plan–implement–review",
} as const;
export type WorkflowTemplate = keyof typeof workflowTemplates;

// Templates are ordinary editable definitions; agent choices are never inferred
// from profile names or list order. Empty choices must be resolved by the editor.
export function starterWorkflow(template: WorkflowTemplate, id: string, agents: { implementer?: string; reviewer?: string; planner?: string }, columns: readonly string[]): Workflow {
  const steps: WorkflowStep[] = [];
  if (template === "plan-implement-review") steps.push(
    { id: "plan", agentId: agents.planner ?? "", instructions: "Plan the task. Explain the approach, validation, and decisions needing human approval." },
    { id: "approve-plan", kind: "checkpoint", instructions: "Review and approve the plan before implementation." },
  );
  steps.push({ id: "implement", agentId: agents.implementer ?? "", instructions: template === "single" ? "Complete the task and verify the result." : "Implement the task using any approved plan and verify the changes." });
  if (template !== "single") steps.push(
    { id: "review", kind: "review", agentId: agents.reviewer ?? "", instructions: "Review the work against the task requirements. Verify fixes and explicitly approve or request changes with actionable findings.", revisionAgentId: agents.implementer ?? "", revisionInstructions: "Address the review findings and verify the changes.", maxRounds: 3 },
    { id: "approve-work", kind: "checkpoint", instructions: "Inspect the completed work and review evidence. Approve the final result." },
  );
  return { id, name: workflowTemplates[template], steps, statusMappings: defaultStatusMappings(columns) };
}
