import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { runWithUsage } from "./usage-store.ts";
import { creditRate, credits, parseUsage } from "./usage-rates.ts";
import { createCodexRunner } from "./codex-runner.ts";
import type { RunRequest } from "./execution-service.ts";
import { GET } from "../app/api/tasks/usage/route.ts";

const tokens = { input_tokens: 100000, cached_input_tokens: 80000, output_tokens: 10000, reasoning_output_tokens: 5000 };
test("credit calculation separates cache and does not add reasoning twice", () => {
  assert.equal(credits(tokens, creditRate("gpt-6.1-sol")!), 3.7);
  assert.equal(creditRate("custom-model"), null);
  assert.equal(parseUsage({ ...tokens, cached_input_tokens: 100001 }), null);
  assert.equal(parseUsage({ ...tokens, output_tokens: -1 }), null);
  assert.equal(parseUsage({ ...tokens, input_tokens: 1.5 }), null);
  assert.equal(parseUsage({ ...tokens, reasoning_output_tokens: 10001 }), null);
  assert.equal(parseUsage({}), null);
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-usage-"));
  const path = join(directory, "db.sqlite");
  const store = new TaskStore(path);
  store.save({ id: "task", title: "Usage", description: "", status: "To do" });
  const request: RunRequest = { task: store.list()[0], workspace: directory, signal: new AbortController().signal, onStart: () => {},
    run: { id: "call", taskId: "task", workspaceId: store.workspaceId, workspacePath: directory, column: "To do", status: "Running",
      profile: { id: "agent", name: "Builder", tool: "codex", model: "gpt-6.1-sol", effort: "medium", permissions: "read-only", instructions: "" },
      createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, summary: null, ownerPid: null, runnerPid: null } };
  return { directory, path, store, request, close: () => { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}
test("all activity types record independent calls, repeated snapshots replace counts, and failures retain usage", async () => {
  const f = fixture();
  try {
    const runner = async (request: RunRequest) => { request.onUsage?.(tokens); request.onUsage?.(tokens); return "Done"; };
    await runWithUsage(f.store, runner, f.request);
    await runWithUsage(f.store, runner, { ...f.request, run: { ...f.request.run, id: "reply", kind: "reply" } });
    await runWithUsage(f.store, runner, { ...f.request, privateChat: { messages: [] }, run: { ...f.request.run, id: "chat" } });
    await runWithUsage(f.store, runner, { ...f.request, privateChat: { messages: [] }, run: { ...f.request.run, id: "intent", kind: "intent" } });
    await assert.rejects(runWithUsage(f.store, async request => { request.onUsage?.(tokens); throw new Error("No handover"); }, { ...f.request, run: { ...f.request.run, id: "failed" } }));
    const data = f.store.usage().read("task");
    assert.equal(data.totals.calls, 5); assert.equal(data.totals.tokens, 550000); assert.equal(data.totals.credits, 18.5);
    assert.equal(data.groups.chat.calls, 1); assert.equal(data.groups.background.calls, 1); assert.equal(data.groups.reply.calls, 1);
    assert.equal(data.calls.find(c => c.id === "failed")!.credits, 3.7);
    assert.equal(data.calls[0].rate!.version, "2026-11-23");
    f.store.delete("task");
    const db = new DatabaseSync(f.path); assert.equal(db.prepare("SELECT count(*) AS n FROM task_usage").get()!.n, 0); db.close();
  } finally { f.close(); }
});
test("missing counts, unknown rates, restart recovery and workspace isolation", async () => {
  const f = fixture();
  try {
    await runWithUsage(f.store, async () => "Done", f.request);
    await runWithUsage(f.store, async request => { request.onUsage?.(tokens); return "Done"; }, { ...f.request, run: { ...f.request.run, id: "unknown-model", profile: { ...f.request.run.profile, model: "custom" } } });
    f.store.usage().begin({ ...f.request, run: { ...f.request.run, id: "orphan" } }, "chat");
    const db = new DatabaseSync(f.path); db.prepare("UPDATE task_usage SET ownerPid = -1, ownerIdentity = 'missing' WHERE id = 'orphan'").run(); db.close();
    const data = f.store.usage().read("task");
    assert.equal(data.totals.unknown, 2); assert.equal(data.totals.unpriced, 1);
    assert.equal(data.calls.find(c => c.id === "orphan")!.outcome, "Interrupted");
    const other = f.store.createWorkspace("Other", f.directory); const otherStore = new TaskStore(f.path, other.id);
    assert.throws(() => otherStore.usage().read("task")); otherStore.close();
    const previous = process.env.TODAI_DB_PATH; process.env.TODAI_DB_PATH = f.path;
    try {
      assert.equal(GET(new Request("http://localhost/api/tasks/usage?taskId=task")).status, 400);
      const response = GET(new Request("http://localhost/api/tasks/usage?taskId=task", { headers: { "X-Todai-Workspace": f.store.workspaceId } }));
      assert.equal(response.status, 200);
      const body = await response.json(); assert.equal(body.totals.calls, 3); assert.equal(body.calls, undefined); assert.equal(JSON.stringify(body).includes("ownerPid"), false);
    } finally { if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous; }
  } finally { f.close(); }
});
test("Codex streams bounded lines and captures usage before missing handover errors", async () => {
  const f = fixture();
  try {
    const executable = join(f.directory, "codex");
    writeFileSync(executable, `#!${process.execPath}
process.stdin.resume();
process.stdin.on('end', () => {
 process.stdout.write('x'.repeat(1100000) + '\\n');
 process.stdout.write('invalid\\n' + JSON.stringify({type:'turn.completed',usage:{input_tokens:-1}}) + '\\n');
 const event = JSON.stringify({type:'turn.completed',usage:${JSON.stringify(tokens)}});
 process.stdout.write(event.slice(0, 35));
 setTimeout(() => process.stdout.write(event.slice(35)), 20);
});`, { mode: 0o755 });
    await assert.rejects(runWithUsage(f.store, createCodexRunner(executable), f.request), /without a handover/);
    assert.deepEqual(f.store.usage().read("task").calls[0].tokens, tokens);
  } finally { f.close(); }
});

test("legacy runs stay unknown, migration is repeatable, and message deletion preserves usage", async () => {
  const f = fixture();
  try {
    f.store.saveAgent(f.request.run.profile);
    f.store.assignColumnAgent({ column: "To do", agentId: "agent" });
    f.store.runTask("task");
    const old = f.store.claimRun()!;
    f.store.finishRun(old.id, "Complete", "Old handover");
    const historical = f.store.usage().read("task");
    assert.equal(historical.totals.unknown, 1);
    assert.equal(historical.totals.measured, 0);
    const since = historical.trackingSince;
    const reopened = new TaskStore(f.path, f.store.workspaceId);
    assert.equal(reopened.usage().read("task").trackingSince, since); reopened.close();
    await runWithUsage(f.store, async request => { request.onUsage?.(tokens); return "Done"; }, f.request);
    const db = new DatabaseSync(f.path);
    db.prepare("DELETE FROM comments WHERE taskId = 'task'").run(); db.close();
    assert.equal(f.store.usage().read("task").totals.tokens, 110000);
    assert.equal(f.store.usage().read("task").totals.credits, 3.7);
  } finally { f.close(); }
});

test("cancellation records an interrupted call without zero usage, and Claude is excluded", async () => {
  const f = fixture();
  try {
    const controller = new AbortController();
    await assert.rejects(runWithUsage(f.store, async () => { controller.abort(); throw new Error("Stopped"); }, { ...f.request, signal: controller.signal }));
    const data = f.store.usage().read("task");
    assert.equal(data.calls[0].outcome, "Interrupted"); assert.equal(data.calls[0].tokens, null);
    await runWithUsage(f.store, async () => "Done", { ...f.request, run: { ...f.request.run, id: "claude", profile: { ...f.request.run.profile, tool: "claude" } } });
    assert.equal(f.store.usage().read("task").totals.calls, 1);
  } finally { f.close(); }
});

test("model breakdown separates effort levels and preserves the recorded profile", async () => {
  const f = fixture();
  try {
    for (const [id, model, effort] of [["a", "gpt-6.1-sol", "medium"], ["b", "gpt-6.1-sol", "high"], ["c", "gpt-6.1-sol", "medium"], ["d", "gpt-6-luna", "low"]] as const) {
      await runWithUsage(f.store, async request => { request.onUsage?.(tokens); return "Done"; }, { ...f.request, run: { ...f.request.run, id, profile: { ...f.request.run.profile, model, effort } } });
    }
    const data = f.store.usage().read("task");
    assert.equal(data.models.length, 3);
    const medium = data.models.find(row => row.model === "gpt-6.1-sol" && row.effort === "medium")!;
    assert.equal(medium.totals.calls, 2);
    assert.equal(medium.totals.uncachedInput, 40000);
    assert.equal(medium.totals.cachedInput, 160000);
    assert.equal(medium.totals.output, 20000);
    assert.equal(medium.totals.tokens, 220000);
    assert.equal(data.models.reduce((sum, row) => sum + row.totals.tokens, 0), data.totals.tokens);
  } finally { f.close(); }
});

test("effort migration uses saved workflow profiles and leaves old chat effort unknown", async () => {
  const f = fixture();
  try {
    f.store.saveAgent(f.request.run.profile);
    f.store.assignColumnAgent({ column: "To do", agentId: "agent" });
    f.store.runTask("task");
    const run = f.store.claimRun()!;
    const runner = async (request: RunRequest) => { request.onUsage?.(tokens); return "Done"; };
    await runWithUsage(f.store, runner, { ...f.request, run });
    f.store.finishRun(run.id, "Complete", "Done");
    await runWithUsage(f.store, runner, { ...f.request, privateChat: { messages: [] } });
    const db = new DatabaseSync(f.path);
    db.exec("ALTER TABLE task_usage DROP COLUMN effort"); db.close();
    const reopened = new TaskStore(f.path, f.store.workspaceId);
    try {
      const data = reopened.usage().read("task");
      assert.equal(data.calls.find(call => call.id === run.id)!.effort, "medium");
      assert.equal(data.calls.find(call => call.id === "call")!.effort, null);
      assert.equal(data.models.length, 2);
    } finally { reopened.close(); }
  } finally { f.close(); }
});

test("header credits total all boards in the workspace and exclude other workspaces", async () => {
  const f = fixture();
  try {
    const runner = async (request: RunRequest) => { request.onUsage?.(tokens); return "Done"; };
    await runWithUsage(f.store, runner, f.request);
    const board = f.store.saveBoard("Second");
    const second = new TaskStore(f.path, f.store.workspaceId, { boardId: board.id });
    try {
      second.save({ id: "second", title: "Second task", description: "", status: "To do" });
      await runWithUsage(second, runner, { ...f.request, run: { ...f.request.run, id: "second-call", taskId: "second" } });
      assert.equal(second.usage().workspaceCredits().credits, 7.4);
    } finally { second.close(); }
    assert.deepEqual(f.store.usage().workspaceCredits(), { credits: 7.4, calls: 2, priced: 2, measured: 2,
      breakdown: { uncachedInput: { tokens: 40000, credits: 2 }, cachedInput: { tokens: 160000, credits: .4 }, output: { tokens: 20000, credits: 5 } } });
    const other = f.store.createWorkspace("Other", f.directory);
    const otherStore = new TaskStore(f.path, other.id);
    try { assert.deepEqual(otherStore.usage().workspaceCredits(), { credits: 0, calls: 0, priced: 0, measured: 0,
      breakdown: { uncachedInput: { tokens: 0, credits: 0 }, cachedInput: { tokens: 0, credits: 0 }, output: { tokens: 0, credits: 0 } } }); }
    finally { otherStore.close(); }
  } finally { f.close(); }
});
