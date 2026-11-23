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
import { createCodexRunner } from "./codex-runner.ts";
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
        tool: "codex",
        model: "configured-model",
        effort: "high",
        instructions: "Use shared components",
        permissions: "read-only",
      },
    },
  };
}

test("Codex adapter passes the profile and task context, and reads the final handover", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-codex-"));
  const executable = join(directory, "fake-codex");
  writeFileSync(
    executable,
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  fs.writeFileSync('received.json', JSON.stringify({ args, prompt, cwd: process.cwd() }));
  fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], 'Built and verified the board');
});
`,
    { mode: 0o755 },
  );
  try {
    assert.equal(
      await createCodexRunner(executable)({ ...request(directory), artifacts: { url: "http://127.0.0.1:12345/mcp", token: "test-token", context: [] } }),
      "Built and verified the board",
    );
    const received = JSON.parse(
      readFileSync(join(directory, "received.json"), "utf8"),
    );
    assert.equal(received.cwd, realpathSync(directory));
    for (const arg of [
      "exec",
      "configured-model",
      'model_reasoning_effort="high"',
      "read-only",
      'approval_policy="never"',
      'mcp_servers.todai_artifacts.default_tools_approval_mode="approve"',
      'mcp_servers.todai_artifacts.url="http://127.0.0.1:12345/mcp"',
      'mcp_servers.todai_artifacts.http_headers={ Authorization = "Bearer test-token" }',
    ])
      assert.ok(received.args.includes(arg), arg);
    for (const context of [
      "Use shared components",
      "Keep keyboard navigation",
      "Earlier handover",
      "nominate_artifact",
      "Artifact operations meeting the publication policy above are authorized.",
      "Do not create an artifact when the useful context can be found in a message.",
      "A normal run may produce no artifacts.",
      "report the actual error and continue any independent work",
    ])
      assert.ok(received.prompt.includes(context), context);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Codex launch, nonzero exit, and missing handover are failures", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-codex-errors-"));
  const executable = join(directory, "fake-codex");
  try {
    await assert.rejects(
      createCodexRunner(executable)(request(directory)),
      /Could not launch Codex CLI/,
    );
    writeFileSync(
      executable,
      `#!${process.execPath}\nprocess.stderr.write('Unsupported model'); process.exit(2);`,
      { mode: 0o755 },
    );
    await assert.rejects(
      createCodexRunner(executable)(request(directory)),
      /code 2.*\nUnsupported model/,
    );
    writeFileSync(executable, `#!${process.execPath}\nprocess.exit(0);`, {
      mode: 0o755,
    });
    await assert.rejects(createCodexRunner(executable)(request(directory)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stopping Codex waits for its process group and preserves workspace changes", async () => {
  const { setTimeout: delay } = await import("node:timers/promises");
  const directory = mkdtempSync(join(tmpdir(), "todai-codex-stop-"));
  const executable = join(directory, "fake-codex");
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
  const running = createCodexRunner(executable)({
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
    assert.ok(childPid, "Codex command should start");
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

test("private Codex chat disables external integrations and uses a chat prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-private-codex-"));
  const executable = join(directory, "fake-codex");
  writeFileSync(executable, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  fs.writeFileSync('received.json', JSON.stringify({ args, prompt }));
  fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], 'Private answer');
});
`, { mode: 0o755 });
  try {
    const input = request(directory);
    await createCodexRunner(executable)({ ...input, privateChat: { messages: [] } });
    const { args, prompt } = JSON.parse(readFileSync(join(directory, "received.json"), "utf8"));
    assert.ok(args.includes("mcp_servers={}"));
    assert.ok(args.includes("shell_tool"));
    assert.ok(args.includes("apps"));
    assert.ok(args.includes("plugins"));
    assert.ok(args.includes("read-only"));

    await createCodexRunner(executable)({ ...input, privateChat: { messages: [], toolsEnabled: true }, artifacts: { url: "http://127.0.0.1:12345/mcp", token: "chat-token", context: [] } });
    const enabled = JSON.parse(readFileSync(join(directory, "received.json"), "utf8"));
    assert.match(enabled.prompt, /standard agent tools/);
    assert.ok(!enabled.args.includes("shell_tool"));
    assert.ok(!enabled.args.includes("mcp_servers={}"));
    assert.ok(enabled.args.includes('mcp_servers.todai_artifacts.required=true'));
    assert.match(prompt, /saved only in this chat/);
    assert.doesNotMatch(prompt, /automatically posted as a comment/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
