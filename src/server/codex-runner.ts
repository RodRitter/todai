import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Runner } from "./execution-service.ts";
import { runCli } from "./cli-process.ts";
import { agentPrompt } from "./agent-prompt.ts";

export function createCodexRunner(executable = "codex"): Runner {
  return async (request) => {
    const { run, workspace, onStart, signal } = request;
    const directory = await mkdtemp(join(tmpdir(), "todai-handover-"));
    const output = join(directory, "handover.txt");
    try {
      await runCli({ executable, label: "Codex CLI", cwd: workspace, onStart, signal, input: agentPrompt(request), timeout: run.kind === "intent" ? 60000 : 0, args: [
            "exec",
            ...(request.artifacts ? [
              "--config", `mcp_servers.todai_artifacts.url=${JSON.stringify(request.artifacts.url)}`,
              "--config", `mcp_servers.todai_artifacts.http_headers={ Authorization = ${JSON.stringify(`Bearer ${request.artifacts.token}`)} }`,
              "--config", "mcp_servers.todai_artifacts.required=true",
              "--config", 'mcp_servers.todai_artifacts.default_tools_approval_mode="approve"',
            ] : []),
            "--cd",
            workspace,
            "--model",
            run.profile.model,
            "--config",
            `model_reasoning_effort=${JSON.stringify(run.profile.effort)}`,
            "--config",
            'approval_policy="never"',
            "--sandbox",
            run.profile.permissions,
            "--skip-git-repo-check",
            "--ephemeral",
            "--color",
            "never",
            "--output-last-message",
            output,
            "-",
          ] });
      const summary = (await readFile(output, "utf8").catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
      })).trim();
      if (!summary) throw new Error("Codex CLI finished without a handover. Check the task before retrying.");
      return summary;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
}
