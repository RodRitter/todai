import { workflowSteps, parseStatusMappings, type Workflow } from "./workflow.ts";
import { parseAgentProfile, type AgentProfile } from "./column-agent.ts";

export type Configuration = {
  format: "todai-configuration";
  version: 1 | 2;
  workflows?: Workflow[];
  agents: AgentProfile[];
  columns: { id: string; name: string }[];
  assignments: { columnId: string; agentId: string }[];
};

export class ConfigurationValidationError extends Error {}

export function parseConfiguration(input: unknown): Configuration {
  const fail = (message: string): never => { throw new ConfigurationValidationError(message); };
  if (!input || typeof input !== "object") return fail("Choose a Todai configuration JSON file.");
  const data = input as Configuration;
  if (data.format !== "todai-configuration" || (data.version !== 1 && data.version !== 2))
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
  if (data.version === 2) {
    if (!Array.isArray(data.workflows) || assignments.length) return fail("Version 2 requires workflows and no column assignments.");
    const ids = new Set<string>();
    for (const workflow of data.workflows) {
      if (!workflow || typeof workflow.id !== "string" || !workflow.id.trim() || ids.has(workflow.id) || typeof workflow.name !== "string" || !workflow.name.trim()) return fail("Workflow IDs must be unique and names nonempty.");
      ids.add(workflow.id);
      const steps = workflowSteps(workflow);
      if (!Array.isArray(steps) || !steps.length) return fail("Each workflow needs at least one step.");
      for (const step of steps) {
        if (!step || (step.kind !== "checkpoint" && !agents.some((agent) => agent.id === step.agentId)) || (step.kind === "review" && !agents.some((agent) => agent.id === step.revisionAgentId))) return fail(`Workflow ${workflow.name}: all agents must be included in the file.`);
      }
      if (workflow.statusMappings !== undefined) {
        try { parseStatusMappings(workflow.statusMappings, data.columns.map((column) => column.name)); }
        catch (error) { return fail(`Workflow ${workflow.name}: ${error instanceof Error ? error.message : "Invalid status mapping."}`); }
      }
    }
  }
  return { format: "todai-configuration", version: data.version, ...(data.version === 2 ? { workflows: data.workflows } : {}), agents, columns: data.columns.map(({ id, name }) => ({ id, name })), assignments };
}

export function selectConfiguration(data: Configuration, agentIds: string[], columns: string[]): Configuration {
  return {
    format: "todai-configuration", version: data.version,
    ...(data.version === 2 ? { workflows: (data.workflows ?? []).filter((workflow) => workflowSteps(workflow).every((step) => step.kind === "checkpoint" || (agentIds.includes(step.agentId) && (step.kind !== "review" || agentIds.includes(step.revisionAgentId)))) && Object.values(workflow.statusMappings ?? {}).every((name) => name === null || data.columns.some((column) => column.name === name && columns.includes(column.id)))) } : {}),
    agents: data.agents.filter((agent) => agentIds.includes(agent.id)),
    columns: data.columns.filter((column) => columns.includes(column.id)),
    assignments: data.assignments.filter((assignment) => columns.includes(assignment.columnId) && agentIds.includes(assignment.agentId)),
  };
}
