import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { GET, POST } from "../app/api/execution/route.ts";

test("global execution HTTP controls target the observed run across workspaces and validate actions", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-execution-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const second = store.createWorkspace("Second", directory);
  const other = new TaskStore(process.env.TODAI_DB_PATH, second.id);
  const post = (body: unknown) => POST(new Request("http://localhost/api/execution", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  }));
  try {
    other.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "high", instructions: "", permissions: "workspace-write" });
    other.assignColumnAgent({ column: "In progress", agentId: "agent" });
    other.save({ id: "task", title: "Other workspace task", description: "", status: "In progress", autoRun: true });
    const run = other.claimRun()!;
    const state = await GET().json();
    assert.equal(state.active.workspaceName, "Second");
    assert.equal(state.active.taskTitle, "Other workspace task");
    assert.equal(state.active.agentName, "Agent");
    assert.equal((await post({ action: "stop", runId: "stale" })).status, 409);
    assert.equal(other.executionState().paused, false);
    for (const input of [null, {}, { action: "unknown" }, { action: "stop" }]) assert.equal((await post(input)).status, 400);
    assert.equal((await post({ action: "stop", runId: run.id })).status, 200);
    assert.equal(store.executionState().paused, true);
    assert.equal(other.interruptionRequested(run.id), true);
    other.finishRun(run.id, "Complete", "Too late");
    assert.equal((await post({ action: "resume" })).status, 200);
    assert.equal(other.list()[0].agentStatus, "Stopped");
    assert.equal(store.executionState().paused, false);
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    store.close(); other.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Stop from a settings-only session recovers and terminates an orphaned process group", async () => {
  const { execFileSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const { setTimeout: delay } = await import("node:timers/promises");
  const directory = mkdtempSync(join(tmpdir(), "todai-orphan-stop-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  let pid: number | null = null;
  try {
    store.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "high", instructions: "", permissions: "workspace-write" });
    store.assignColumnAgent({ column: "In progress", agentId: "agent" });
    store.save({ id: "orphan", title: "Orphan", description: "", status: "In progress", autoRun: true });
    const agentScript = `const fs = require('node:fs');
      const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
      fs.writeFileSync('child.pid', String(child.pid)); setInterval(() => {}, 1000);`;
    execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import { TaskStore } from ${JSON.stringify(new URL("./task-store.ts", import.meta.url).href)};
      import { spawn } from 'node:child_process';
      const store = new TaskStore(process.env.TODAI_DB_PATH);
      const run = store.claimRun();
      const agent = spawn(process.execPath, ['-e', ${JSON.stringify(agentScript)}], { cwd: ${JSON.stringify(directory)}, detached: true, stdio: 'ignore' });
      store.recordRunner(run.id, agent.pid); agent.unref(); store.close();
    `], { stdio: "pipe" });
    const run = store.history()[0];
    pid = run.runnerPid;
    let childPid = 0;
    for (let i = 0; i < 100; i++) {
      try { childPid = Number(readFileSync(join(directory, "child.pid"), "utf8")); break; }
      catch { await delay(20); }
    }
    assert.ok(childPid);
    const response = await POST(new Request("http://localhost/api/execution", { method: "POST", body: JSON.stringify({ action: "stop", runId: run.id }) }));
    assert.equal(response.status, 200);
    for (let i = 0; i < 100 && store.history()[0].status === "Running"; i++) await delay(20);
    assert.equal(store.history()[0].status, "Stopped");
    assert.equal(store.executionState().paused, true);
    assert.throws(() => process.kill(pid!, 0), { code: "ESRCH" });
    assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" });
  } finally {
    if (pid) { try { process.kill(-pid, "SIGKILL"); } catch {} }
    store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
