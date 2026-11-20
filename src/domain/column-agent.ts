import type { Status } from "./task.ts";

export const executionTools = [
  {
    value: "codex",
    label: "Codex CLI",
    efforts: ["low", "medium", "high", "xhigh"],
    permissions: [
      { value: "read-only", label: "Read only" },
      { value: "workspace-write", label: "Write to workspace" },
      { value: "danger-full-access", label: "Full access (no sandbox)" },
    ],
    defaultPermissions: "workspace-write",
    permissionHelp: "Codex sandbox controls filesystem access. Interactive approvals are disabled.",
    // Suggestions from the local Codex catalog; custom model IDs are also accepted.
    models: [
      "gpt-6.1-sol",
      "gpt-6-astra",
      "gpt-6.1-terra",
      "gpt-6-sol",
      "gpt-6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ],
  },
  {
    value: "claude",
    label: "Claude Code",
    models: ["sonnet", "opus", "haiku"],
    efforts: ["low", "medium", "high", "xhigh", "max"],
    permissions: [
      { value: "dontAsk", label: "Configured permissions (no prompts)" },
      { value: "acceptEdits", label: "Accept file edits" },
      { value: "auto", label: "Automatic permission review" },
      { value: "bypassPermissions", label: "Bypass permission checks" },
    ],
    defaultPermissions: "dontAsk",
    permissionHelp: "Claude permission modes are not a filesystem sandbox. Accept edits permits file changes; other commands need configured permissions. Unresolved approval requests are denied.",
  },
] as const;
export type ExecutionTool = (typeof executionTools)[number]["value"];

export type AgentProfile = {
  id: string;
  name: string;
  tool: ExecutionTool;
  model: string;
  effort: (typeof executionTools)[number]["efforts"][number];
  instructions: string;
  requireApprovalBeforeEdits?: boolean;
  permissions: (typeof executionTools)[number]["permissions"][number]["value"];
};

export class AgentValidationError extends Error {
  field?: keyof AgentProfile;
  constructor(message: string, field?: keyof AgentProfile) {
    super(message);
    this.field = field;
  }
}

export function parseAgentProfile(input: unknown): AgentProfile {
  if (!input || typeof input !== "object")
    throw new AgentValidationError("Enter agent settings.");
  const agent = input as AgentProfile;
  if (typeof agent.id !== "string" || !agent.id.trim())
    throw new AgentValidationError("An agent ID is required.");
  if (typeof agent.name !== "string" || !agent.name.trim())
    throw new AgentValidationError("Enter an agent name.", "name");
  const tool = executionTools.find((tool) => tool.value === agent.tool);
  if (!tool)
    throw new AgentValidationError(
      `Choose an execution tool: ${executionTools.map((tool) => tool.label).join(", ")}.`,
    );
  if (typeof agent.model !== "string" || !agent.model.trim())
    throw new AgentValidationError(
      `Enter a model supported by your ${tool.label} account.`,
      "model",
    );
  if (!(tool.efforts as readonly string[]).includes(agent.effort))
    throw new AgentValidationError(
      `Choose an effort level supported by ${tool.label}: ${tool.efforts.join(", ")}.`,
    );
  if (!tool.permissions.some((mode) => mode.value === agent.permissions))
    throw new AgentValidationError(
      `Choose permissions supported by ${tool.label}.`,
    );
  if (typeof agent.instructions !== "string")
    throw new AgentValidationError(
      "Enter instructions as text, or leave them empty.",
    );
  if (agent.requireApprovalBeforeEdits !== undefined && typeof agent.requireApprovalBeforeEdits !== "boolean")
    throw new AgentValidationError("Choose whether edits require approval.");
  return {
    id: agent.id,
    name: agent.name.trim(),
    tool: tool.value,
    model: agent.model.trim(),
    effort: agent.effort,
    instructions: agent.instructions,
    requireApprovalBeforeEdits: agent.requireApprovalBeforeEdits ?? false,
    permissions: agent.permissions,
  };
}

export type ColumnAssignment = { column: Status; agentId: string };

export function parseExecutionTool(value: unknown): ExecutionTool {
  const tool = executionTools.find((tool) => tool.value === value);
  if (!tool) throw new AgentValidationError("Choose a supported executor.");
  return tool.value;
}

export function executorLabel(tool: ExecutionTool) {
  return executionTools.find((entry) => entry.value === tool)!.label;
}

export type ExecutorStatus = {
  tool: ExecutionTool;
  installed: boolean;
  signedIn: boolean | null;
  message: string;
};
export type ExecutorSettingsData = {
  defaultExecutor: ExecutionTool;
  statuses?: ExecutorStatus[];
};
