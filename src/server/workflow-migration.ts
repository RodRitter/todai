import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { defaultStatusMappings, type Workflow, type WorkflowStep } from "../domain/workflow.ts";
import { saveWorkflow } from "./workflow-store.ts";

export type MigrationReport = { state: "complete" | "blocked"; affectedTaskIds: string[]; blockedTaskIds: string[] };

// Conversion runs inside the caller's transaction. Legacy rows remain available
// until all pending work has drained; a persisted report makes retries harmless.
export function migrateColumnAutomation(db: DatabaseSync): MigrationReport {
  const saved = db.prepare("SELECT value FROM settings WHERE workspaceId = workspace_id() AND key = 'workflowMigration'").get();
  if (saved) return JSON.parse(saved.value as string);
  const tasks = db.prepare("SELECT id, status, autoRun, autoWorkflow FROM tasks WHERE workspaceId = workspace_id() AND workflowId IS NULL ORDER BY rowid").all();
  const columns = db.prepare("SELECT name FROM board_columns WHERE workspaceId = workspace_id() ORDER BY position").all().map((row) => row.name as string);
  const assignments = db.prepare("SELECT column, agentId FROM column_assignments WHERE workspaceId = workspace_id()").all();
  const affectedTaskIds = tasks.filter((task) => assignments.some((item) => item.column === task.status)).map((task) => task.id as string);
  const blockedTaskIds = db.prepare(`SELECT DISTINCT taskId FROM runs WHERE workspaceId = workspace_id() AND workflowExecutionId IS NULL
    AND (status IN ('Queued', 'Running') OR (status = 'Waiting' AND EXISTS (SELECT 1 FROM comments WHERE comments.runId = runs.id AND feedbackStatus = 'pending')))`)
    .all().map((row) => row.taskId as string);
  if (blockedTaskIds.length) return { state: "blocked", affectedTaskIds, blockedTaskIds };
  const definitions = new Map<string, string>();
  function convert(start: string, automatic: boolean) {
    const key = JSON.stringify([start, automatic]);
    if (definitions.has(key)) return definitions.get(key)!;
    const workflow = legacyPipeline(columns, assignments as { column: string; agentId: string }[], start, automatic);
    const id = workflow.id;
    saveWorkflow(db, workflow);
    definitions.set(key, id);
    return id;
  }
  for (const task of tasks) {
    if (!affectedTaskIds.includes(task.id as string)) continue;
    const workflowId = convert(task.status as string, Boolean(task.autoRun && task.autoWorkflow));
    db.prepare("UPDATE tasks SET workflowId = ? WHERE id = ? AND workspaceId = workspace_id()").run(workflowId, task.id);
  }
  // Even an unused legacy pipeline remains available as an explicit workflow.
  const first = columns.find((column) => assignments.some((item) => item.column === column));
  if (first && ![...definitions.keys()].some((key) => JSON.parse(key)[0] === first)) convert(first, false);
  for (const row of db.prepare("SELECT id FROM workflows WHERE workspaceId = workspace_id() AND statusMappings IS NULL").all()) {
    db.prepare("UPDATE workflows SET statusMappings = ? WHERE id = ?").run(JSON.stringify(defaultStatusMappings(columns)), row.id);
  }
  db.exec("DELETE FROM column_assignments WHERE workspaceId = workspace_id(); UPDATE tasks SET autoRun = 0, autoWorkflow = 0 WHERE workspaceId = workspace_id();");
  const report: MigrationReport = { state: "complete", affectedTaskIds, blockedTaskIds: [] };
  db.prepare("INSERT INTO settings (workspaceId, key, value) VALUES (workspace_id(), 'workflowMigration', ?)").run(JSON.stringify(report));
  return report;
}

export function legacyPipeline(columns: string[], assignments: { column: string; agentId: string }[], start: string, automatic: boolean): Workflow {
  const steps: WorkflowStep[] = [];
  let unassignedGap = false;
  for (const column of columns.slice(columns.indexOf(start))) {
    const assignment = assignments.find((item) => item.column === column);
    if (!assignment) { unassignedGap = true; continue; }
    if (steps.length && (!automatic || unassignedGap))
      steps.push({ id: randomUUID(), kind: "checkpoint", instructions: `Approve continuation to the former ${column} agent.` });
    steps.push({ id: randomUUID(), agentId: assignment.agentId, instructions: "" });
    unassignedGap = false;
  }
  return { id: randomUUID(), name: `Migrated ${start} · ${automatic ? "automatic" : "manual"} continuation`, steps, statusMappings: defaultStatusMappings(columns) };
}
