import { parseMemoryTransfer, selectMemory, type MemoryTransfer } from "./memory-transfer.ts";
import { parseAgentProfile, type AgentProfile } from "./column-agent.ts";

export type Configuration = {
  format: "todai-configuration";
  version: 1;
  memory?: MemoryTransfer;
  agents: AgentProfile[];
  columns: { id: string; name: string; instructions?: string; completion?: boolean }[];
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
  if (data.columns.some((column) => column.instructions !== undefined && (typeof column.instructions !== "string" || column.instructions.length > 20000)))
    return fail("Column instructions must contain no more than 20,000 characters.");
  if (data.columns.some((column) => column.completion !== undefined && typeof column.completion !== "boolean") || data.columns.filter((column) => column.completion).length > 1)
    return fail("Choose at most one completion column per board.");
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
  let memory: MemoryTransfer | undefined;
  try { if (data.memory !== undefined) memory = parseMemoryTransfer(data.memory); }
  catch { return fail("Invalid memory export."); }
  return { format: "todai-configuration", version: 1, ...(memory ? { memory } : {}), agents, columns: data.columns.map(({ id, name, instructions, completion }) => ({ id, name, ...(instructions !== undefined ? { instructions } : {}), ...(completion !== undefined ? { completion } : {}) })), assignments };
}

export function selectConfiguration(data: Configuration, agentIds: string[], columns: string[], memoryIds: string[] = []): Configuration {
  return {
    format: "todai-configuration", version: 1,
    ...(data.memory && memoryIds.length ? { memory: selectMemory(data.memory, memoryIds) } : {}),
    agents: data.agents.filter((agent) => agentIds.includes(agent.id)),
    columns: data.columns.filter((column) => columns.includes(column.id)),
    assignments: data.assignments.filter((assignment) => columns.includes(assignment.columnId) && agentIds.includes(assignment.agentId)),
  };
}
