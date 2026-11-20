import assert from "node:assert/strict";
import {
  mkdtempSync,
  realpathSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createClaudeRunner } from "./claude-runner.ts";
import type { RunRequest } from "./execution-service.ts";

function request(workspace: string): RunRequest {
  return {
    workspace,
    signal: new AbortController().signal,
    onStart: () => {},
    task: {
      id: "task",
      title: "Build board",
      description: "Keep keyboard navigation",
      status: "In progress",
      agentStatus: "Running",
      comments: [
        {
          id: "comment",
          taskId: "task",
          body: "Earlier handover",
          createdAt: "2026-11-16T12:00:00Z",
        },
      ],
    },
    run: {
      workspaceId: "workspace",
      workspacePath: workspace,
      id: "run",
      taskId: "task",
      column: "In progress",
      status: "Running",
      createdAt: "",
      startedAt: null,
      finishedAt: null,
      summary: null,
      ownerPid: process.pid,
      runnerPid: null,
      profile: {
        id: "agent",
        name: "Builder",
        tool: "claude",
        model: "configured-model",
        effort: "high",
        instructions: "Use shared components",
        permissions: "dontAsk",
      },
    },
  };
}

test("Claude adapter passes the profile and task context, and reads the final handover", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-claude-"));
  const executable = join(directory, "fake-claude");
  writeFileSync(
    executable,
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  fs.writeFileSync('received.json', JSON.stringify({ args, prompt, cwd: process.cwd() }));
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Built and verified the board' }));
});
`,
    { mode: 0o755 },
  );
  try {
    assert.equal(
      await createClaudeRunner(executable)({ ...request(directory), artifacts: { url: "http://127.0.0.1:12345/mcp", token: "test-token", context: [] } }),
      "Built and verified the board",
    );
    const received = JSON.parse(
      readFileSync(join(directory, "received.json"), "utf8"),
    );
    assert.equal(received.cwd, realpathSync(directory));
    assert.deepEqual(JSON.parse(received.args[received.args.indexOf("--mcp-config") + 1]), { mcpServers: { todai_artifacts: { type: "http", url: "http://127.0.0.1:12345/mcp", headers: { Authorization: "Bearer test-token" } } } });
    assert.ok(received.args.includes("mcp__todai_artifacts"));
    for (const arg of [
      "-p",
      "--output-format",
      "json",
      "--no-session-persistence",
      "--permission-prompts",
      "none",
      "configured-model",
      "high",
      "dontAsk",
    ])
      assert.ok(received.args.includes(arg), arg);
    for (const context of [
      "Use shared components",
      "Keep keyboard navigation",
      "Earlier handover",
    ])
      assert.ok(received.prompt.includes(context), context);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Claude launch, nonzero exit, and missing handover are failures", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-claude-errors-"));
  const executable = join(directory, "fake-claude");
  try {
    await assert.rejects(
      createClaudeRunner(executable)(request(directory)),
      /Could not launch Claude Code/,
    );
    writeFileSync(
      executable,
      `#!${process.execPath}\nprocess.stderr.write('Unsupported model'); process.exit(2);`,
      { mode: 0o755 },
    );
    await assert.rejects(
      createClaudeRunner(executable)(request(directory)),
      /code 2.*\nUnsupported model/,
    );
    writeFileSync(executable, `#!${process.execPath}\nprocess.exit(0);`, {
      mode: 0o755,
    });
    await assert.rejects(createClaudeRunner(executable)(request(directory)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stopping Claude waits for its process group and preserves workspace changes", async () => {
  const { setTimeout: delay } = await import("node:timers/promises");
  const directory = mkdtempSync(join(tmpdir(), "todai-claude-stop-"));
  const executable = join(directory, "fake-claude");
  writeFileSync(
    executable,
    `#!${process.execPath}
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
fs.writeFileSync('changes.txt', 'Work in progress');
fs.writeFileSync('child.pid', String(child.pid));
setInterval(() => {}, 1000);
`,
    { mode: 0o755 },
  );
  const controller = new AbortController();
  let pid: number | undefined;
  const running = createClaudeRunner(executable)({
    ...request(directory),
    signal: controller.signal,
    onStart: (value) => {
      pid = value;
    },
  });
  const outcome = running.then(
    () => "unexpected success",
    () => "stopped",
  );
  try {
    let childPid: number | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        childPid = Number(readFileSync(join(directory, "child.pid"), "utf8"));
        break;
      } catch {
        await delay(20);
      }
    }
    assert.ok(childPid, "Claude command should start");
    controller.abort();
    assert.equal(
      await Promise.race([outcome, delay(2000).then(() => "timed out")]),
      "stopped",
    );
    assert.throws(() => process.kill(pid!, 0));
    assert.throws(() => process.kill(childPid, 0));
    assert.equal(
      readFileSync(join(directory, "changes.txt"), "utf8"),
      "Work in progress",
    );
  } finally {
    if (pid) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    }
    await outcome;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("private Claude chat has no tools or inherited MCP servers", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-private-claude-"));
  const executable = join(directory, "fake-claude");
  writeFileSync(executable, `#!${process.execPath}
const fs = require('node:fs');
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  fs.writeFileSync('received.json', JSON.stringify({ args: process.argv.slice(2), prompt }));
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', result: 'Private answer' }));
});
`, { mode: 0o755 });
  try {
    const input = request(directory);
    await createClaudeRunner(executable)({ ...input, privateChat: { messages: [] } });
    const { args, prompt } = JSON.parse(readFileSync(join(directory, "received.json"), "utf8"));
    assert.equal(args[args.indexOf("--tools") + 1], "");
    assert.ok(args.includes("--strict-mcp-config"));
    assert.ok(args.includes('{"mcpServers":{}}'));
    assert.match(prompt, /saved only in this chat/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
