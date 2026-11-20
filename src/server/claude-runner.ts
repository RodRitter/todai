import type { Runner } from "./execution-service.ts";
import { runCli } from "./cli-process.ts";
import { agentPrompt } from "./agent-prompt.ts";

export function claudeSummary(output: string): string {
  let result;
  try { result = JSON.parse(output); }
  catch { throw new Error("Claude Code returned invalid JSON output."); }
  if (!result || result.type !== "result") throw new Error("Claude Code finished without a result.");
  if (result.is_error || result.subtype !== "success")
    throw new Error(`Claude Code failed: ${String(result.result || result.errors?.join("; ") || result.subtype || "unknown error").slice(-4000)}`);
  if (result.permission_denials?.length)
    throw new Error("Claude Code could not complete all requested actions because permissions were denied. Review the agent's permissions in Agents.");
  if (typeof result.result !== "string" || !result.result.trim()) throw new Error("Claude Code finished without a handover.");
  return result.result.trim();
}

export function createClaudeRunner(executable = "claude"): Runner {
  return async (request) => {
    const { run, workspace, signal, onStart } = request;
    const output = await runCli({
      executable, label: "Claude Code", cwd: workspace, signal, onStart,
      input: agentPrompt(request), timeout: run.kind === "intent" ? 60000 : 0,
      args: [
        ...(request.artifacts ? [
          "--mcp-config", JSON.stringify({ mcpServers: { todai_artifacts: { type: "http", url: request.artifacts.url, headers: { Authorization: `Bearer ${request.artifacts.token}` } } } }),
          "--allowedTools", "mcp__todai_artifacts",
        ] : []),
        ...(request.privateChat ? ["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'] : []),
        "-p", "--output-format", "json", "--no-session-persistence",
        "--permission-prompts", "none", "--model", run.profile.model,
        "--effort", run.profile.effort, "--permission-mode", run.profile.permissions],
    });
    return claudeSummary(output);
  };
}
