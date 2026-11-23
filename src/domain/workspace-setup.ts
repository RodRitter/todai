import { parseUserName } from "./user-name.ts";
import { statuses } from "./task.ts";
import type { AgentProfile } from "./column-agent.ts";

export const starterAgents = [
  { id: "planner", name: "Planner", description: "Turn a task into a short, actionable plan.", permissions: "read-only", instructions: "Read the task and relevant project files. Write a short implementation plan with clear steps and any questions that block progress. Do not change files." },
  { id: "builder", name: "Builder", description: "Make focused changes and check the result.", permissions: "workspace-write", instructions: "Implement the task with small, focused changes. Follow the project's conventions, run relevant checks, and summarize what changed and any remaining issues." },
  { id: "reviewer", name: "Reviewer", description: "Check work for bugs and missing requirements.", permissions: "read-only", instructions: "Review the work against the task requirements. Look for bugs, regressions, and missing checks. Report actionable findings with file references. Do not change files." },
] as const;

export type WorkspaceSetup = { columns: string[]; starterAgentIds: string[]; userName?: string };
export class WorkspaceSetupError extends Error {}

export function parseWorkspaceSetup(input: unknown): WorkspaceSetup {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkspaceSetupError("Enter workspace setup options.");
  const value = input as Partial<WorkspaceSetup>;
  const columns = value.columns ?? [...statuses];
  const ids = value.starterAgentIds ?? [];
  if (!Array.isArray(columns) || !columns.length || columns.some((name) => typeof name !== "string" || !name.trim()))
    throw new WorkspaceSetupError("Give each column a name and keep at least one column.");
  const names = columns.map((name) => name.trim());
  if (new Set(names).size !== names.length) throw new WorkspaceSetupError("Use a different name for each column.");
  if (!Array.isArray(ids) || ids.some((id) => !starterAgents.some((agent) => agent.id === id)) || new Set(ids).size !== ids.length)
    throw new WorkspaceSetupError("Choose valid starter agents.");
  return { columns: names, starterAgentIds: ids, ...(value.userName !== undefined ? { userName: parseUserName(value.userName) } : {}) };
}

export function starterAgentProfile(id: string, profileId: string): AgentProfile {
  const starter = starterAgents.find((agent) => agent.id === id)!;
  return { id: profileId, name: starter.name, instructions: starter.instructions, permissions: starter.permissions, tool: "codex", model: "gpt-6.1-sol", effort: "medium" };
}
