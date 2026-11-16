import { parseAgentProfile, type ExecutionTool } from "../domain/column-agent.ts";
import { createCodexRunner } from "./codex-runner.ts";
import { createClaudeRunner } from "./claude-runner.ts";
import type { Runner } from "./execution-service.ts";

export function createExecutorRunner(runners: Record<ExecutionTool, Runner> = {
  codex: createCodexRunner(), claude: createClaudeRunner(),
}): Runner {
  return (request) => {
    const profile = parseAgentProfile(request.run.profile);
    return runners[profile.tool](request);
  };
}
