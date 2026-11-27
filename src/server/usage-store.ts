import { parseCredits } from "../domain/credit-settings.ts";
import type { DatabaseSync } from "node:sqlite";
import type { TaskStore } from "./task-store.ts";
import type { Runner, RunRequest } from "./execution-service.ts";
import type { TaskUsage, UsageCall, UsageKind, TokenUsage, WorkspaceCredits } from "../domain/usage.ts";
import { modelUsage, usageTotals } from "../domain/usage.ts";
import { creditRate, credits } from "./usage-rates.ts";
import { processIdentity } from "./process-identity.ts";

export function initializeUsageSchema(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS task_usage (
    id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, runId TEXT,
    agentName TEXT NOT NULL, model TEXT NOT NULL, kind TEXT NOT NULL,
    startedAt TEXT NOT NULL, finishedAt TEXT, outcome TEXT NOT NULL, complete INTEGER NOT NULL DEFAULT 0,
    tokens TEXT, rate TEXT, credits REAL, ownerPid INTEGER, ownerIdentity TEXT
  ); CREATE INDEX IF NOT EXISTS task_usage_task ON task_usage(workspaceId, taskId);
  CREATE TABLE IF NOT EXISTS usage_metadata (id INTEGER PRIMARY KEY CHECK(id = 1), trackingSince TEXT NOT NULL);
  INSERT OR IGNORE INTO usage_metadata VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);
  if (!db.prepare("PRAGMA table_info(task_usage)").all().some(column => column.name === "effort")) {
    db.exec(`ALTER TABLE task_usage ADD COLUMN effort TEXT;
      UPDATE task_usage SET effort = (
        SELECT json_extract(runs.profile, '$.effort') FROM runs
        WHERE runs.id = task_usage.runId AND runs.workspaceId = task_usage.workspaceId AND runs.taskId = task_usage.taskId
      );`);
  }
  // Workspace chat calls have no task. Rebuild once, preserving all legacy columns and rows.
  if (db.prepare("PRAGMA table_info(task_usage)").all().some(column => column.name === "taskId" && column.notnull)) {
    const schema = String(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'task_usage'").get()!.sql);
    db.exec(schema.replace("CREATE TABLE task_usage", "CREATE TABLE task_usage_nullable").replace("taskId TEXT NOT NULL", "taskId TEXT"));
    db.exec("INSERT INTO task_usage_nullable SELECT * FROM task_usage; DROP TABLE task_usage; ALTER TABLE task_usage_nullable RENAME TO task_usage; CREATE INDEX task_usage_task ON task_usage(workspaceId, taskId)");
  }

}
export class UsageStore {
  private db: DatabaseSync;
  private workspaceId: string;
  constructor(db: DatabaseSync, workspaceId: string) { this.db = db; this.workspaceId = workspaceId; }
  begin(request: RunRequest, kind: UsageKind) {
    const { run } = request;
    this.db.prepare(`INSERT OR IGNORE INTO task_usage (id, workspaceId, taskId, runId, agentName, model, kind, startedAt, outcome, rate, ownerPid, ownerIdentity, effort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Running', ?, ?, ?, ?)`).run(run.id, this.workspaceId, run.taskId, request.privateChat ? null : run.id,
      run.profile.name, run.profile.model, kind, new Date().toISOString(), JSON.stringify(creditRate(run.profile.model)), process.pid, processIdentity(process.pid) ?? null, run.profile.effort);
  }
  beginWorkspaceChat(id: string, model: string, effort: string) {
    this.db.prepare(`INSERT INTO task_usage (id, workspaceId, taskId, runId, agentName, model, kind, startedAt, outcome, rate, ownerPid, ownerIdentity, effort)
      VALUES (?, ?, NULL, NULL, 'Assistant', ?, 'chat', ?, 'Running', ?, ?, ?, ?)`)
      .run(id, this.workspaceId, model, new Date().toISOString(), JSON.stringify(creditRate(model)), process.pid, processIdentity(process.pid) ?? null, effort);
  }
  record(id: string, tokens: TokenUsage) {
    const row = this.db.prepare("SELECT rate FROM task_usage WHERE id = ? AND workspaceId = ?").get(id, this.workspaceId);
    if (!row) return;
    const rate = JSON.parse(String(row.rate));
    this.db.prepare("UPDATE task_usage SET tokens = ?, credits = ?, complete = 1 WHERE id = ? AND workspaceId = ?")
      .run(JSON.stringify(tokens), rate ? credits(tokens, rate) : null, id, this.workspaceId);
  }
  finish(id: string, outcome: UsageCall["outcome"]) {
    this.db.prepare("UPDATE task_usage SET outcome = ?, finishedAt = ? WHERE id = ? AND workspaceId = ?")
      .run(outcome, new Date().toISOString(), id, this.workspaceId);
  }
  workspaceCredits(): WorkspaceCredits {
    for (const row of this.db.prepare("SELECT id, ownerPid, ownerIdentity, startedAt FROM task_usage WHERE workspaceId = ? AND taskId IS NULL AND outcome = 'Running'").all(this.workspaceId)) {
      if (!row.ownerPid || processIdentity(Number(row.ownerPid)) !== row.ownerIdentity || Date.parse(String(row.startedAt)) + 360000 < Date.now()) this.finish(String(row.id), "Interrupted");
    }
    const row = this.db.prepare(`SELECT COALESCE(SUM(credits), 0) AS credits, COUNT(*) AS calls,
      COUNT(credits) AS priced, COUNT(tokens) AS measured,
      COALESCE(SUM(json_extract(tokens, '$.input_tokens') - json_extract(tokens, '$.cached_input_tokens')), 0) AS uncachedInput,
      COALESCE(SUM(json_extract(tokens, '$.cached_input_tokens')), 0) AS cachedInput,
      COALESCE(SUM(json_extract(tokens, '$.output_tokens')), 0) AS output,
      COALESCE(SUM((json_extract(tokens, '$.input_tokens') - json_extract(tokens, '$.cached_input_tokens')) * json_extract(rate, '$.input') / 1000000.0), 0) AS inputCredits,
      COALESCE(SUM(json_extract(tokens, '$.cached_input_tokens') * json_extract(rate, '$.cached') / 1000000.0), 0) AS cachedCredits,
      COALESCE(SUM(json_extract(tokens, '$.output_tokens') * json_extract(rate, '$.output') / 1000000.0), 0) AS outputCredits
      FROM task_usage WHERE workspaceId = ? AND (taskId IS NULL OR EXISTS (
        SELECT 1 FROM tasks WHERE tasks.id = task_usage.taskId
          AND tasks.workspaceId = task_usage.workspaceId AND tasks.archivedAt IS NULL
      ))`).get(this.workspaceId)!;
    return { credits: Number(row.credits), calls: Number(row.calls), priced: Number(row.priced), measured: Number(row.measured),
      breakdown: {
        uncachedInput: { tokens: Number(row.uncachedInput), credits: Number(row.inputCredits) },
        cachedInput: { tokens: Number(row.cachedInput), credits: Number(row.cachedCredits) },
        output: { tokens: Number(row.output), credits: Number(row.outputCredits) },
      } };
  }
  activeTaskCredits(): number {
    const row = this.db.prepare(`SELECT COALESCE(SUM(credits), 0) AS credits FROM task_usage
      WHERE workspaceId = ? AND EXISTS (
        SELECT 1 FROM tasks WHERE tasks.id = task_usage.taskId
          AND tasks.workspaceId = task_usage.workspaceId AND tasks.archivedAt IS NULL
      )`).get(this.workspaceId)!;
    return Number(row.credits);
  }
  trackedCredits() {
    const usage = this.workspaceCredits();
    const offset = Number(this.db.prepare("SELECT value FROM settings WHERE key = 'creditOffset' AND workspaceId = ?").get(this.workspaceId)?.value ?? 0);
    return { ...usage, taskCredits: this.activeTaskCredits(), trackedCredits: Math.max(0, usage.credits + offset) };
  }
  setTrackedCredits(value: unknown) {
    const current = parseCredits(value);
    const offset = current - this.workspaceCredits().credits;
    this.db.prepare("INSERT INTO settings (key, value, workspaceId) VALUES ('creditOffset', ?, ?) ON CONFLICT(workspaceId, key) DO UPDATE SET value = excluded.value").run(String(offset), this.workspaceId);
    return this.trackedCredits();
  }
  taskCredits(): Map<string, import("../domain/usage.ts").TaskCreditUsage> {
    const rows = this.db.prepare(`
      SELECT taskId, COALESCE(SUM(credits), 0) AS credits, COUNT(*) AS calls,
        COUNT(credits) AS priced, SUM(outcome = 'Running') AS pending
      FROM (
        SELECT taskId, credits, outcome FROM task_usage WHERE workspaceId = ? AND taskId IS NOT NULL
        UNION ALL
        SELECT taskId, NULL AS credits, status AS outcome FROM runs
        WHERE workspaceId = ? AND startedAt IS NOT NULL
          AND json_extract(profile, '$.tool') = 'codex'
          AND NOT EXISTS (SELECT 1 FROM task_usage WHERE task_usage.id = runs.id)
      ) GROUP BY taskId
    `).all(this.workspaceId, this.workspaceId);
    return new Map(rows.map(row => [String(row.taskId), {
      credits: Number(row.credits), calls: Number(row.calls),
      priced: Number(row.priced), pending: Number(row.pending),
    }]));
  }

  read(taskId: string): TaskUsage {
    if (!this.db.prepare("SELECT id FROM tasks WHERE id = ? AND workspaceId = ?").get(taskId, this.workspaceId)) throw new Error("Task not found.");
    for (const row of this.db.prepare("SELECT id, ownerPid, ownerIdentity FROM task_usage WHERE workspaceId = ? AND taskId = ? AND outcome = 'Running'").all(this.workspaceId, taskId)) {
      if (!row.ownerPid || !row.ownerIdentity || processIdentity(Number(row.ownerPid)) !== row.ownerIdentity) this.finish(String(row.id), "Interrupted");
    }
    const calls = this.db.prepare("SELECT * FROM task_usage WHERE workspaceId = ? AND taskId = ? ORDER BY startedAt DESC, rowid DESC").all(this.workspaceId, taskId).map((row): UsageCall => ({
      id: String(row.id), agentName: String(row.agentName), model: String(row.model), effort: row.effort as string | null, kind: row.kind as UsageKind,
      startedAt: String(row.startedAt), finishedAt: row.finishedAt as string | null, outcome: row.outcome as UsageCall["outcome"], complete: !!row.complete,
      tokens: row.tokens ? JSON.parse(String(row.tokens)) : null, rate: row.rate ? JSON.parse(String(row.rate)) : null, credits: row.credits as number | null,
    }));
    const old = this.db.prepare(`SELECT * FROM runs WHERE workspaceId = ? AND taskId = ? AND startedAt IS NOT NULL
      AND json_extract(profile, '$.tool') = 'codex' AND NOT EXISTS (SELECT 1 FROM task_usage WHERE task_usage.id = runs.id)`).all(this.workspaceId, taskId);
    for (const row of old) {
      const profile = JSON.parse(String(row.profile));
      calls.push({ id: String(row.id), agentName: profile.name, model: profile.model, effort: profile.effort ?? null, kind: row.kind === "intent" || row.kind === "memory" ? "background" : row.kind === "reply" ? "reply" : "workflow",
        startedAt: String(row.startedAt), finishedAt: row.finishedAt as string | null, outcome: row.status === "Running" ? "Running" : row.status === "Complete" || row.status === "Waiting" ? "Complete" : "Interrupted",
        complete: false, tokens: null, rate: null, credits: null });
    }
    calls.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return { trackingSince: String(this.db.prepare("SELECT trackingSince FROM usage_metadata WHERE id = 1").get()!.trackingSince), calls, totals: usageTotals(calls), models: modelUsage(calls),
      groups: { workflow: usageTotals(calls.filter(c => c.kind === "workflow")), reply: usageTotals(calls.filter(c => c.kind === "reply")), chat: usageTotals(calls.filter(c => c.kind === "chat")), background: usageTotals(calls.filter(c => c.kind === "background")) } };
  }
}
export async function runWithUsage(store: TaskStore, runner: Runner, request: RunRequest) {
  if (request.run.profile.tool !== "codex") return runner(request);
  const usage = store.usage();
  usage.begin(request, (request.run.kind === "intent" || request.run.kind === "memory") ? "background" : request.privateChat ? "chat" : request.run.kind === "reply" ? "reply" : "workflow");
  try {
    const result = await runner({ ...request, onUsage: tokens => usage.record(request.run.id, tokens) });
    usage.finish(request.run.id, "Complete");
    return result;
  } catch (error) {
    usage.finish(request.run.id, request.signal.aborted ? "Interrupted" : "Failed");
    throw error;
  }
}
