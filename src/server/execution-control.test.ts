import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { runCli } from "./cli-process.ts";
import { setTimeout as delay } from "node:timers/promises";
import { ExecutionService } from "./execution-service.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-stop-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  store.saveAgent({ id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build", permissions: "workspace-write" });
  for (const column of ["In progress", "In review"]) store.assignColumnAgent({ column, agentId: "builder" });
  return { store, path, cleanup() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("stop wins a late completion, preserves history, and keeps the global queue paused after reopening", async () => {
  const f = fixture();
  let complete!: (summary: string) => void;
  const service = new ExecutionService(f.store, () => new Promise((resolve) => { complete = resolve; }));
  try {
    f.store.save({ id: "active", title: "Active", description: "Saved work", status: "In progress", autoRun: true, autoWorkflow: true });
    f.store.postComment("active", "Keep this history");
    f.store.save({ id: "waiting", title: "Waiting", description: "", status: "In progress", autoRun: true });
    const draining = service.drain();
    const run = f.store.history("active")[0];
    f.store.stopExecution(run.id);
    assert.equal(f.store.list().find((task) => task.id === "active")?.agentStatus, "Stopped");
    complete("Late successful result");
    await draining;
    assert.equal(f.store.history("active")[0].status, "Stopped");
    assert.equal(f.store.list().find((task) => task.id === "active")?.status, "In progress");
    assert.equal(f.store.history("waiting")[0].status, "Queued");
    assert.ok(f.store.list()[0].comments?.some((comment) => comment.body === "Keep this history"));
    const reopened = new TaskStore(f.path);
    try {
      assert.equal(reopened.executionState().paused, true);
      assert.equal(reopened.claimRun(), undefined);
      reopened.resumeExecution();
      assert.equal(reopened.list().find((task) => task.id === "active")?.agentStatus, "Stopped");
      assert.equal(reopened.claimRun()?.taskId, "waiting");
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test("restart creates a fresh run with history without resuming the queue or triggering comment replies", async () => {
  const f = fixture();
  try {
    f.store.save({ id: "discussion", title: "Discuss", description: "Saved details", status: "In progress" });
    f.store.postComment("discussion", "[@Builder](#agent/builder) please review");
    const run = f.store.claimRun()!;
    assert.equal(run.kind, "intent");
    f.store.stopExecution(run.id);
    f.store.finishRun(run.id, "Complete", "builder", undefined, f.store.listAgents());
    assert.equal(f.store.history().length, 1);
    f.store.runTask("discussion");
    assert.equal(f.store.history().length, 2);
    assert.equal(f.store.claimRun(), undefined);
    const service = new ExecutionService(f.store, async ({ task }) => {
      assert.equal(task.description, "Saved details");
      assert.ok(task.comments?.some((comment) => comment.body.includes("please review")));
      return "New run completed";
    });
    f.store.resumeExecution();
    await service.drain();
    assert.deepEqual(f.store.history().map((item) => item.status), ["Stopped", "Complete"]);
  } finally { f.cleanup(); }
});

test("stop kills the agent and its child before any subsequent run, preserving files", async () => {
  const f = fixture();
  const directory = join(f.path, "..");
  let pid: number | undefined;
  const service = new ExecutionService(f.store, ({ signal, onStart }) => runCli({
    executable: process.execPath, label: "Test agent", cwd: directory, signal,
    onStart(value) { pid = value; onStart(value); },
    args: ["-e", `const fs = require('node:fs');
      const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
      fs.writeFileSync('saved.txt', 'Saved work');
      fs.writeFileSync('child.pid', String(child.pid));
      setInterval(() => {}, 1000);`],
  }));
  let draining: Promise<void> | undefined;
  try {
    f.store.save({ id: "process", title: "Process", description: "", status: "In progress", autoRun: true });
    draining = service.drain();
    let childPid = 0;
    for (let i = 0; i < 100; i++) {
      try { childPid = Number(readFileSync(join(directory, "child.pid"), "utf8")); break; }
      catch { await delay(20); }
    }
    assert.ok(childPid, "child process starts");
    f.store.stopExecution(f.store.history()[0].id);
    f.store.resumeExecution(); // Even an immediate resume must not release the running slot early.
    assert.equal(f.store.claimRun(), undefined);
    await draining;
    assert.throws(() => process.kill(pid!, 0), { code: "ESRCH" });
    assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" });
    assert.equal(readFileSync(join(directory, "saved.txt"), "utf8"), "Saved work");
    assert.equal(f.store.history()[0].status, "Stopped");
  } finally {
    if (pid) { try { process.kill(-pid, "SIGKILL"); } catch {} }
    await draining;
    f.cleanup();
  }
});

test("stopping preserves other queued requests and moving the task cannot restart it", async () => {
  const f = fixture();
  try {
    f.store.save({ id: "task", title: "Task", description: "", status: "In progress", autoRun: true });
    const active = f.store.claimRun()!;
    f.store.postComment("task", "@Builder review the saved changes later");
    f.store.stopExecution(active.id);
    f.store.finishRun(active.id, "Complete", "Late completion");
    assert.deepEqual(f.store.history().map((run) => run.status), ["Stopped", "Queued"]);
    f.store.resumeExecution();
    assert.equal(f.store.claimRun(), undefined);
    f.store.save({ ...f.store.list()[0], status: "In review" });
    assert.equal(f.store.list()[0].agentStatus, "Stopped");
    assert.equal(f.store.history().filter((run) => run.status === "Queued").length, 1);
    assert.equal(f.store.claimRun(), undefined);
    f.store.runTask("task");
    assert.equal(f.store.history().length, 3);
    assert.ok(f.store.claimRun());
  } finally { f.cleanup(); }
});
