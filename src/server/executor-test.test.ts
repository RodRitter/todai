import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { testExecutor } from "./executor-test.ts";

async function fixture(mode: string, run: (executable: string, directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "todai-probe-fixture-"));
  const executable = join(directory, "codex");
  await writeFile(executable, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const mode = ${JSON.stringify(mode)};
fs.writeFileSync(${JSON.stringify(join(directory, "cwd"))}, process.cwd());
if (mode === 'timeout') setInterval(() => {}, 1000);
else if (args[0] === 'login' && mode === 'login') {
  console.error('Not logged in'); process.exit(1);
} else if (args[0] === 'exec') {
  if (mode === 'network') { console.error('Connection refused'); process.exit(2); }
  if (!args.includes('read-only') || !args.includes('approval_policy="never"')) process.exit(3);
  if (mode !== 'missing') fs.writeFileSync(args[args.indexOf('--output-last-message') + 1],
    mode === 'wrong' ? 'Did not run a tool' : fs.readFileSync('probe.txt', 'utf8'));
}
`, { mode: 0o755 });
  try {
    await run(executable, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("executor probe verifies the file result and removes its temporary workspace", async () => {
  await fixture("success", async (executable, directory) => {
    assert.match((await testExecutor(executable)).message, /successfully executed/);
    const workspace = await readFile(join(directory, "cwd"), "utf8");
    await assert.rejects(readFile(join(workspace, "probe.txt")), { code: "ENOENT" });
  });
});

test("executor probe explains missing CLI, login, execution, and result failures", async () => {
  await assert.rejects(testExecutor("/nonexistent/todai-codex"), /Could not find Codex CLI.*PATH/);
  for (const [mode, message] of [
    ["login", /Sign-in check.*code 1.*codex login[\s\S]*Not logged in/],
    ["network", /Tool execution check.*code 2[\s\S]*Connection refused/],
    ["missing", /Tool verification failed/],
    ["wrong", /Tool verification failed/],
  ] as const) {
    await fixture(mode, async (executable, directory) => {
      await assert.rejects(testExecutor(executable), message);
      const workspace = await readFile(join(directory, "cwd"), "utf8");
      await assert.rejects(readFile(join(workspace, "probe.txt")), { code: "ENOENT" });
    });
  }
});

test("executor probe stops a hung CLI and reports the timed out stage", async () => {
  await fixture("timeout", async (executable) => {
    await assert.rejects(testExecutor(executable, 100), /CLI availability check: timed out/);
  });
});
