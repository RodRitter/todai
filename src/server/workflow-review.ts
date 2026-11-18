import type { DatabaseSync } from "node:sqlite";
import type { ReviewState } from "../domain/workflow.ts";

export function readReview(db: DatabaseSync, executionId: string, stepId: string): ReviewState | undefined {
  const row = db.prepare("SELECT state FROM workflow_reviews WHERE executionId = ? AND stepId = ?").get(executionId, stepId);
  if (!row) return undefined;
  const state: ReviewState = JSON.parse(row.state as string);
  // Active older loops have summaries but no verified finding dispositions.
  // Give those reports stable identities before any new reviewer can approve.
  if (!state.findingRecords && state.phase !== "complete") {
    state.findingRecords = state.attempts.filter((attempt) => attempt.outcome === "changes-requested" && attempt.findings).map((attempt) => ({
      id: `finding-${attempt.runId}`, body: attempt.findings!, status: "outstanding", introducedRunId: attempt.runId,
      dispositions: [{ runId: attempt.runId, round: attempt.round, status: "outstanding", note: "Reported before finding tracking; explicit verification required." }],
    }));
  }
  return state;
}

export function saveReview(db: DatabaseSync, executionId: string, stepId: string, state: ReviewState) {
  db.prepare("INSERT INTO workflow_reviews (executionId, stepId, state) VALUES (?, ?, ?) ON CONFLICT(executionId, stepId) DO UPDATE SET state = excluded.state")
    .run(executionId, stepId, JSON.stringify(state));
}

export function reviewResult(summary: string, state: ReviewState, runId: string) {
  try {
    const value = JSON.parse(summary.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, "$1"));
    if (!value || !["approved", "changes-requested"].includes(value.outcome) || typeof value.findings !== "string" || !value.findings.trim()) return;
    const updates = value.findingUpdates ?? (value.outcome === "changes-requested"
      ? [{ id: `finding-${runId}`, body: value.findings.trim(), status: "outstanding", note: "Reported by reviewer" }] : []);
    if (!Array.isArray(updates)) return;
    const records = structuredClone(state.findingRecords ?? []);
    const seen = new Set<string>();
    for (const update of updates) {
      if (!update || typeof update.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(update.id) || seen.has(update.id) ||
          !["outstanding", "resolved"].includes(update.status) || typeof update.note !== "string" || !update.note.trim()) return;
      seen.add(update.id);
      let record = records.find((item) => item.id === update.id);
      if (!record) {
        if (update.status !== "outstanding" || typeof update.body !== "string" || !update.body.trim()) return;
        record = { id: update.id, body: update.body.trim(), status: "outstanding", introducedRunId: runId, dispositions: [] };
        records.push(record);
      } else if (update.body !== undefined && update.body !== record.body) return;
      record.status = update.status;
      record.dispositions.push({ runId, round: state.round, status: update.status, note: update.note.trim() });
    }
    if (value.outcome === "approved" && records.some((item) => item.status === "outstanding")) return;
    if (value.outcome === "changes-requested" && !records.some((item) => item.status === "outstanding")) return;
    return { outcome: value.outcome as "approved" | "changes-requested", findings: value.findings.trim() as string, findingRecords: records, findingUpdates: updates };
  } catch { /* Invalid results remain paused for explicit recovery. */ }
}
