import type { DatabaseSync } from "node:sqlite";
import { workflowSteps, type Workflow, type WorkflowStep } from "../domain/workflow.ts";

export class WorkflowValidationError extends Error {}

export function listWorkflows(db: DatabaseSync): Workflow[] {
  return db.prepare("SELECT id, name, agentId, instructions, steps FROM workflows WHERE workspaceId = workspace_id() ORDER BY rowid").all().map((row) => row.steps
    ? { id: row.id, name: row.name, steps: JSON.parse(row.steps as string) }
    : { id: row.id, name: row.name, agentId: row.agentId, instructions: row.instructions }) as Workflow[];
}

export function saveWorkflow(db: DatabaseSync, input: unknown): Workflow {
  if (!input || typeof input !== "object") throw new WorkflowValidationError("Enter workflow details.");
  const value = input as Workflow;
  if (typeof value.id !== "string" || !value.id.trim() || typeof value.name !== "string" || !value.name.trim())
    throw new WorkflowValidationError("Enter a workflow name.");
  const steps = value.steps === undefined ? workflowSteps(value) : value.steps;
  if (!Array.isArray(steps) || !steps.length) throw new WorkflowValidationError("Add at least one step.");
  const ids = new Set<string>();
  const validated = steps.map((step: WorkflowStep, index) => {
    if (!step || typeof step.id !== "string" || !step.id.trim() || ids.has(step.id) || typeof step.instructions !== "string")
      throw new WorkflowValidationError(`Step ${index + 1}: provide a unique step ID and valid instructions.`);
    ids.add(step.id);
    if (step.kind === "checkpoint") {
      if (!step.instructions.trim()) throw new WorkflowValidationError(`Step ${index + 1}: describe what the human must review.`);
      return { id: step.id, kind: "checkpoint" as const, instructions: step.instructions };
    }
    if (step.kind !== undefined && step.kind !== "agent" && step.kind !== "review") throw new WorkflowValidationError(`Step ${index + 1}: choose a supported step type.`);
    if (typeof step.agentId !== "string" || !db.prepare("SELECT id FROM agents WHERE id = ? AND workspaceId = workspace_id()").get(step.agentId))
      throw new WorkflowValidationError(`Step ${index + 1}: choose an existing agent in this workspace.`);
    if (step.kind === "review") {
      const maxRounds = step.maxRounds ?? 3;
      if (!Number.isSafeInteger(maxRounds) || maxRounds <= 0)
        throw new WorkflowValidationError("Enter a positive whole number of review rounds.");
      if (typeof step.revisionInstructions !== "string" || !step.revisionInstructions.trim() || !step.instructions.trim())
        throw new WorkflowValidationError("Provide reviewer and revision instructions.");
      if (typeof step.revisionAgentId !== "string" || !db.prepare("SELECT id FROM agents WHERE id = ? AND workspaceId = workspace_id()").get(step.revisionAgentId))
        throw new WorkflowValidationError("Choose an existing revision agent in this workspace.");
      return { id: step.id, kind: "review" as const, agentId: step.agentId, instructions: step.instructions, revisionAgentId: step.revisionAgentId, revisionInstructions: step.revisionInstructions, maxRounds };
    }
    return { id: step.id, agentId: step.agentId, instructions: step.instructions };
  });
  if (db.prepare("SELECT id FROM workflows WHERE id = ? AND workspaceId <> workspace_id()").get(value.id))
    throw new WorkflowValidationError("This workflow belongs to another workspace.");
  const workflow: Workflow = value.steps === undefined
    ? { id: value.id, name: value.name.trim(), agentId: validated[0].agentId!, instructions: validated[0].instructions }
    : { id: value.id, name: value.name.trim(), steps: validated };
  db.prepare(`INSERT INTO workflows (workspaceId, id, name, agentId, instructions, steps) VALUES (workspace_id(), ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, agentId=excluded.agentId, instructions=excluded.instructions, steps=excluded.steps
    WHERE workflows.workspaceId = excluded.workspaceId`).run(workflow.id, workflow.name, validated[0].agentId ?? "", validated[0].instructions, workflow.steps ? JSON.stringify(workflow.steps) : null);
  return workflow;
}
