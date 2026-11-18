import type { DatabaseSync } from "node:sqlite";
import type { ReviewState } from "../domain/workflow.ts";

export function readReview(db: DatabaseSync, executionId: string, stepId: string): ReviewState | undefined {
  const row = db.prepare("SELECT state FROM workflow_reviews WHERE executionId = ? AND stepId = ?").get(executionId, stepId);
  return row ? JSON.parse(row.state as string) : undefined;
}

export function saveReview(db: DatabaseSync, executionId: string, stepId: string, state: ReviewState) {
  db.prepare("INSERT INTO workflow_reviews (executionId, stepId, state) VALUES (?, ?, ?) ON CONFLICT(executionId, stepId) DO UPDATE SET state = excluded.state")
    .run(executionId, stepId, JSON.stringify(state));
}

export function reviewResult(summary: string): { outcome: "approved" | "changes-requested"; findings: string } | undefined {
  try {
    const value = JSON.parse(summary.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, "$1"));
    if ((value?.outcome === "approved" || value?.outcome === "changes-requested") &&
        typeof value.findings === "string" && value.findings.trim())
      return { outcome: value.outcome, findings: value.findings.trim() };
  } catch { /* Invalid results remain paused for explicit recovery. */ }
}
