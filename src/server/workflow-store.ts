import type { DatabaseSync } from "node:sqlite";
import type { Workflow } from "../domain/workflow.ts";

export class WorkflowValidationError extends Error {}

export function listWorkflows(db: DatabaseSync): Workflow[] {
  return db.prepare("SELECT id, name, agentId, instructions FROM workflows WHERE workspaceId = workspace_id() ORDER BY rowid").all().map((row) => ({ ...row })) as Workflow[];
}

export function saveWorkflow(db: DatabaseSync, input: unknown): Workflow {
  if (!input || typeof input !== "object") throw new WorkflowValidationError("Enter workflow details.");
  const value = input as Workflow;
  if (typeof value.id !== "string" || !value.id.trim() || typeof value.name !== "string" || !value.name.trim() ||
      typeof value.instructions !== "string" || typeof value.agentId !== "string")
    throw new WorkflowValidationError("Enter a workflow name, agent, and valid instructions.");
  if (!db.prepare("SELECT id FROM agents WHERE id = ? AND workspaceId = workspace_id()").get(value.agentId))
    throw new WorkflowValidationError("Choose an existing agent in this workspace.");
  if (db.prepare("SELECT id FROM workflows WHERE id = ? AND workspaceId <> workspace_id()").get(value.id))
    throw new WorkflowValidationError("This workflow belongs to another workspace.");
  const workflow = { id: value.id, name: value.name.trim(), agentId: value.agentId, instructions: value.instructions };
  db.prepare(`INSERT INTO workflows (workspaceId, id, name, agentId, instructions) VALUES (workspace_id(), ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, agentId=excluded.agentId, instructions=excluded.instructions
    WHERE workflows.workspaceId = excluded.workspaceId`).run(workflow.id, workflow.name, workflow.agentId, workflow.instructions);
  return workflow;
}
