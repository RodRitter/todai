import { parseAgentProfile, type AgentProfile } from "./column-agent.ts";

export type Configuration = {
  format: "todai-configuration";
  version: 1;
  agents: AgentProfile[];
  columns: { id: string; name: string }[];
  assignments: { columnId: string; agentId: string }[];
};

export class ConfigurationValidationError extends Error {}

export function parseConfiguration(input: unknown): Configuration {
  const fail = (message: string): never => { throw new ConfigurationValidationError(message); };
  if (!input || typeof input !== "object") return fail("Choose a Todai configuration JSON file.");
  const data = input as Configuration;
  if (data.format !== "todai-configuration" || data.version !== 1)
    return fail("Unsupported configuration format or version.");
  if (!Array.isArray(data.agents) || !Array.isArray(data.columns) || !Array.isArray(data.assignments))
    return fail("Configuration must contain agents, columns, and assignments lists.");
  let agents: AgentProfile[];
  try { agents = data.agents.map(parseAgentProfile); }
  catch (error) { return fail(error instanceof Error ? error.message : "Invalid agent."); }
  if (new Set(agents.map((agent) => agent.id)).size !== agents.length)
    return fail("Agent IDs must be unique.");
  if (data.columns.some((column) => !column || typeof column.id !== "string" || !column.id.trim() || typeof column.name !== "string" || !column.name.trim() || column.name !== column.name.trim() || column.name.length > 80))
    return fail("Column names must contain 1–80 characters without surrounding spaces.");
  if (new Set(data.columns.map((column) => column.name.toLowerCase())).size !== data.columns.length)
    return fail("Column names must be unique.");
  if (new Set(data.columns.map((column) => column.id)).size !== data.columns.length)
    return fail("Column IDs must be unique.");
  const assignments = data.assignments.map((assignment) => {
    if (!assignment || typeof assignment !== "object" || !data.columns.some((column) => column.id === assignment.columnId) || !agents.some((agent) => agent.id === assignment.agentId))
      return fail("Assignments must reference agents and columns included in the file.");
    return { columnId: assignment.columnId, agentId: assignment.agentId };
  });
  if (new Set(assignments.map((assignment) => assignment.columnId)).size !== assignments.length)
    return fail("Each column can have only one assignment.");
  return { format: "todai-configuration", version: 1, agents, columns: data.columns.map(({ id, name }) => ({ id, name })), assignments };
}

export function selectConfiguration(data: Configuration, agentIds: string[], columns: string[]): Configuration {
  return {
    format: "todai-configuration", version: 1,
    agents: data.agents.filter((agent) => agentIds.includes(agent.id)),
    columns: data.columns.filter((column) => columns.includes(column.id)),
    assignments: data.assignments.filter((assignment) => columns.includes(assignment.columnId) && agentIds.includes(assignment.agentId)),
  };
}
