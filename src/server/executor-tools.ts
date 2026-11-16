import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { executionTools, executorLabel, type ExecutionTool, type ExecutorStatus } from "../domain/column-agent.ts";
import { runCli } from "./cli-process.ts";
import { claudeSummary } from "./claude-runner.ts";
import { testExecutor } from "./executor-test.ts";

export async function inspectExecutor(tool: ExecutionTool, executable = tool as string): Promise<ExecutorStatus> {
  const label = executorLabel(tool);
  const command = (args: string[]) => runCli({ executable, label, args, cwd: tmpdir(), timeout: 5000 });
  try { await command(["--version"]); }
  catch { return { tool, installed: false, signedIn: null, message: `Could not run ${executable}. Install it on the app server's PATH, then refresh status.` }; }
  try {
    await command(tool === "codex" ? ["login", "status"] : ["auth", "status"]);
    return { tool, installed: true, signedIn: true, message: "Installed and signed in. Test connection to verify model and tool access." };
  } catch {
    return { tool, installed: true, signedIn: false, message: `Could not verify sign-in. Run ${tool === "codex" ? "codex login" : "claude auth login"} as the app server user, then refresh status.` };
  }
}

export function inspectExecutors() {
  return Promise.all(executionTools.map((tool) => inspectExecutor(tool.value)));
}

export async function testExecutorTool(tool: ExecutionTool, executable = tool as string, timeout = 60_000) {
  if (tool === "codex") return testExecutor(executable, timeout);
  const directory = await mkdtemp(join(tmpdir(), "todai-claude-probe-"));
  try {
    const command = (args: string[], input?: string) => runCli({ executable, label: "Claude Code", args, input, cwd: directory, timeout });
    await command(["--version"]);
    try { await command(["auth", "status"]); }
    catch (error) { throw new Error(`Sign-in check: run claude auth login as the app server user. ${error instanceof Error ? error.message : error}`); }
    const token = randomUUID();
    await writeFile(join(directory, "probe.txt"), token);
    const result = claudeSummary(await command([
      "-p", "--output-format", "json", "--no-session-persistence",
      "--permission-mode", "dontAsk", "--permission-prompts", "none",
      "--tools", "Read", "--allowedTools", "Read", "--strict-mcp-config", "--mcp-config", "{\"mcpServers\":{}}",
    ], "Use the Read tool to read probe.txt. Reply with only its exact contents."));
    if (result !== token) throw new Error("Tool verification failed: Claude Code did not return the expected file contents.");
    return { message: "Claude Code is signed in and successfully read the test file and returned its contents." };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
