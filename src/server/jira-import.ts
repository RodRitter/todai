import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile } from "../domain/column-agent.ts";
import { jiraImportPrompt, jiraTicketUrl, parseJiraDraft } from "../domain/jira-import.ts";
import { runCli } from "./cli-process.ts";
import { claudeSummary } from "./claude-runner.ts";

export async function importJiraTicket(input: { url: string; agent: AgentProfile; workspace: string; signal?: AbortSignal }, executable = input.agent.tool as string) {
  const url = jiraTicketUrl(input.url);
  const directory = await mkdtemp(join(tmpdir(), "todai-jira-import-"));
  try {
    const output = join(directory, "ticket.json");
    const { agent, workspace, signal } = input;
    const codex = agent.tool === "codex";
    const result = await runCli({ executable, label: "Jira import", cwd: workspace, signal, timeout: 180000,
      input: jiraImportPrompt(url),
      args: codex ? ["exec", "--model", agent.model, "--config", `model_reasoning_effort=${JSON.stringify(agent.effort)}`, "--config", 'approval_policy="never"', "--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check", "--color", "never", "--output-last-message", output, "-"]
        : ["-p", "--output-format", "json", "--no-session-persistence", "--permission-prompts", "none", "--model", agent.model, "--effort", agent.effort, "--permission-mode", "dontAsk"],
    });
    return parseJiraDraft(codex ? await readFile(output, "utf8") : claudeSummary(result), url);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
