import type { Status } from "./task.ts";

export const executionTools = [
  {
    value: "codex",
    label: "Codex CLI",
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
] as const;
export type ExecutionTool = (typeof executionTools)[number]["value"];

export const effortLevels = ["low", "medium", "high", "xhigh"] as const;
export const permissionModes = [
  "read-only",
  "workspace-write",
  "danger-full-access",
] as const;
export type AgentProfile = {
  id: string;
  name: string;
  tool: ExecutionTool;
  model: string;
  effort: (typeof effortLevels)[number];
  instructions: string;
  permissions: (typeof permissionModes)[number];
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
  if (!effortLevels.includes(agent.effort))
    throw new AgentValidationError(
      "Choose an effort level: low, medium, high, or xhigh.",
    );
  if (!permissionModes.includes(agent.permissions))
    throw new AgentValidationError(
      "Choose permissions: read-only, workspace-write, or danger-full-access.",
    );
  if (typeof agent.instructions !== "string")
    throw new AgentValidationError(
      "Enter instructions as text, or leave them empty.",
    );
  return {
    id: agent.id,
    name: agent.name.trim(),
    tool: tool.value,
    model: agent.model.trim(),
    effort: agent.effort,
    instructions: agent.instructions,
    permissions: agent.permissions,
  };
}

export type ColumnAssignment = { column: Status; agentId: string };
