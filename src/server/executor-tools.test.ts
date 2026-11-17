import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectExecutor, testExecutorTool } from "./executor-tools.ts";
import { claudeSummary } from "./claude-runner.ts";
import { parseAgentProfile } from "../domain/column-agent.ts";
import { TaskStore } from "./task-store.ts";
import { createExecutorRunner } from "./executor-runner.ts";
import { ExecutionService } from "./execution-service.ts";

const codex = { id: "codex", name: "Builder", tool: "codex", model: "custom", effort: "high", permissions: "workspace-write", instructions: "Build" };
const claude = { ...codex, id: "claude", name: "Reviewer", tool: "claude", model: "sonnet", permissions: "dontAsk" };

test("executor settings persist without changing profiles or queued snapshots; mixed exports round trip", async () => {
  const directory = await mkdtemp(join(tmpdir(), "todai-executors-"));
  const path = join(directory, "test.sqlite");
  let store = new TaskStore(path);
  try {
    assert.equal(store.getDefaultExecutor(), "codex");
    store.saveAgent(codex);
    store.saveAgent(claude);
    store.assignColumnAgent({ column: "To do", agentId: "codex" });
    store.save({ autoRun: true, id: "task", title: "Build", description: "", status: "To do" });
    const queued = store.history();
    store.setDefaultExecutor("claude");
    assert.throws(() => store.setDefaultExecutor("unknown"));
    assert.deepEqual(store.history(), queued);
    assert.equal(store.listAgents().find((agent) => agent.id === "codex")?.tool, "codex");
    const exported = store.exportConfiguration();
    store.close();
    store = new TaskStore(path);
    assert.equal(store.getDefaultExecutor(), "claude");
    const imported = new TaskStore(":memory:");
    try {
      imported.importConfiguration(JSON.parse(JSON.stringify(exported)));
      assert.deepEqual(imported.listAgents().map(({ tool, permissions }) => ({ tool, permissions })).sort((a,b) => a.tool.localeCompare(b.tool)),
        [{ tool: "claude", permissions: "dontAsk" }, { tool: "codex", permissions: "workspace-write" }]);
      assert.equal(imported.getDefaultExecutor(), "codex", "imports must not change local executor defaults");
    } finally { imported.close(); }
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
});

test("profiles reject cross-executor permissions and unsupported effort", () => {
  assert.equal(parseAgentProfile({ ...claude, effort: "max" }).effort, "max");
  assert.throws(() => parseAgentProfile({ ...codex, effort: "max" }), /effort/);
  assert.throws(() => parseAgentProfile({ ...claude, permissions: "workspace-write" }), /permissions/);
  assert.throws(() => parseAgentProfile({ ...codex, permissions: "acceptEdits" }), /permissions/);
});

test("mixed queue uses each snapshotted tool and continues after executor failure", async () => {
  const store = new TaskStore(":memory:");
  const calls: string[] = [];
  try {
    store.saveAgent(codex); store.saveAgent(claude);
    store.assignColumnAgent({ column: "To do", agentId: "codex" });
    store.assignColumnAgent({ column: "In review", agentId: "claude" });
    store.save({ autoRun: true, id: "one", title: "Build", description: "", status: "To do" });
    store.save({ autoRun: true, id: "two", title: "Review", description: "", status: "In review" });
    store.saveAgent({ ...claude, id: "codex" });
    store.setDefaultExecutor("claude");
    await new ExecutionService(store, createExecutorRunner({
      codex: async () => { calls.push("codex"); throw new Error("Executor unavailable"); },
      claude: async () => { calls.push("claude"); return "Reviewed"; },
    }), tmpdir()).drain();
    assert.deepEqual(calls, ["codex", "claude"]);
    assert.equal(store.list().find((task) => task.id === "one")?.agentStatus, "Failed");
    assert.equal(store.list().find((task) => task.id === "two")?.comments?.[0].body, "Reviewed");
  } finally { store.close(); }
});

test("Claude results reject errors, empty output, and denied permissions", () => {
  for (const result of [null, {}, { type: "result", subtype: "error_max_turns", errors: ["Limit reached"] },
    { type: "result", subtype: "success", is_error: true, result: "Failure" },
    { type: "result", subtype: "success", result: "" },
    { type: "result", subtype: "success", result: "Partial", permission_denials: [{ tool_name: "Bash" }] }]) {
    assert.throws(() => claudeSummary(JSON.stringify(result)));
  }
  assert.throws(() => claudeSummary("not JSON"), /invalid JSON/);
});

test("Claude checks availability, authentication, and actual file access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "todai-claude-test-"));
  const executable = join(directory, "claude");
  try {
    assert.equal((await inspectExecutor("claude", executable)).installed, false);
    const script = (mode: string) => `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'auth' && ${JSON.stringify(mode)} === 'signed-out') process.exit(1);
if (args[0] === '-p') {
  if (!args.includes('dontAsk') || !args.includes('Read') || !args.includes('none')) process.exit(2);
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', result: ${JSON.stringify(mode)} === 'wrong' ? 'wrong' : fs.readFileSync('probe.txt', 'utf8') }));
}
`;
    await writeFile(executable, script("signed-out"), { mode: 0o755 });
    assert.equal((await inspectExecutor("claude", executable)).signedIn, false);
    await assert.rejects(testExecutorTool("claude", executable), /Sign-in check/);
    await writeFile(executable, script("success"), { mode: 0o755 });
    assert.equal((await inspectExecutor("claude", executable)).signedIn, true);
    assert.match((await testExecutorTool("claude", executable)).message, /successfully read/);
    await writeFile(executable, script("wrong"), { mode: 0o755 });
    await assert.rejects(testExecutorTool("claude", executable), /verification failed/);
    await writeFile(executable, `#!${process.execPath}\nsetInterval(() => {}, 1000);`, { mode: 0o755 });
    await assert.rejects(testExecutorTool("claude", executable, 100), /timed out/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
