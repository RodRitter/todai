import type { AgentProfile } from "./column-agent.ts";
import type { RunHistoryEntry } from "./execution.ts";

export type Workflow = { id: string; name: string; agentId: string; instructions: string };
export type WorkflowExecution = {
  id: string;
  taskId: string;
  stepId: string;
  workflow: Workflow;
  profile: AgentProfile;
  createdAt: string;
  status: RunHistoryEntry["status"];
  runs: (RunHistoryEntry & { prompt: string | null })[];
};
