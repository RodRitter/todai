import { parseMemoryTransfer, selectMemory, type MemoryTransfer } from "./memory-transfer.ts";
import { parseAgentProfile, type AgentProfile } from "./column-agent.ts";

export type Configuration = {
  format: "todai-configuration";
  version: 1;
  memory?: MemoryTransfer;
  // Read legacy files during workspace creation; new exports use the boards array order.
  boardOrder?: { id: string; name: string }[];
  boards?: { id: string; name: string; description?: string; columns: Configuration["columns"]; assignments: Configuration["assignments"] }[];
  defaultBoardId?: string;
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
  if (data.boardOrder !== undefined && (!Array.isArray(data.boardOrder) ||
      data.boardOrder.some((board) => !board || typeof board.id !== "string" || !board.id.trim() || typeof board.name !== "string" || !board.name.trim() || board.name !== board.name.trim() || board.name.length > 80) ||
      new Set(data.boardOrder.map((board) => board.id)).size !== data.boardOrder.length ||
      new Set(data.boardOrder.map((board) => board.name.toLowerCase())).size !== data.boardOrder.length))
    return fail("Board order must contain unique board IDs and names.");
  const boardOrder = data.boardOrder?.map(({ id, name }) => ({ id, name }));
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
  let boards: Configuration["boards"];
  if (data.boards !== undefined) {
    if (!Array.isArray(data.boards) || !data.boards.length) return fail("Include at least one board in a workspace export.");
    // Validate board identities with the same rules as board order.
    parseConfiguration({ format: data.format, version: data.version, agents: [], columns: [], assignments: [], boardOrder: data.boards });
    boards = data.boards.map((board) => {
      if (board.description !== undefined && (typeof board.description !== "string" || board.description.length > 500))
        return fail("Board descriptions must contain no more than 500 characters.");
      const content = parseConfiguration({ format: data.format, version: data.version, agents, columns: board.columns, assignments: board.assignments });
      if (!content.columns.length) return fail("Include at least one column in each board.");
      return { id: board.id, name: board.name, ...(board.description !== undefined ? { description: board.description } : {}), columns: content.columns, assignments: content.assignments };
    });
    const columnIds = boards.flatMap((board) => board.columns.map((column) => column.id));
    if (new Set(columnIds).size !== columnIds.length) return fail("Column IDs must be unique across boards.");
    if (typeof data.defaultBoardId !== "string" || !boards.some((board) => board.id === data.defaultBoardId))
      return fail("Choose a default board included in the workspace export.");
  } else if (data.defaultBoardId !== undefined) return fail("Include boards with the default board ID.");
  let memory: MemoryTransfer | undefined;
  try { if (data.memory !== undefined) memory = parseMemoryTransfer(data.memory); }
  catch { return fail("Invalid memory export."); }
  return { format: "todai-configuration", version: 1, ...(boards ? { boards, defaultBoardId: data.defaultBoardId } : {}), ...(memory ? { memory } : {}), ...(boardOrder ? { boardOrder } : {}), agents, columns: data.columns.map(({ id, name, instructions, completion }) => ({ id, name, ...(instructions !== undefined ? { instructions } : {}), ...(completion !== undefined ? { completion } : {}) })), assignments };
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
