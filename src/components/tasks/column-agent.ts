import { statuses, type Status } from './task.ts';

export const effortLevels = ['low', 'medium', 'high', 'xhigh'] as const;
export const permissionModes = ['read-only', 'workspace-write', 'danger-full-access'] as const;
export type ColumnAgent = {
  column: Status;
  name: string;
  tool: 'codex';
  model: string;
  effort: (typeof effortLevels)[number];
  instructions: string;
  permissions: (typeof permissionModes)[number];
};


export class AgentValidationError extends Error {
  field?: keyof ColumnAgent;
  constructor(message: string, field?: keyof ColumnAgent) {
    super(message);
    this.field = field;
  }
}

export function parseColumnAgent(input: unknown): ColumnAgent {
  if (!input || typeof input !== 'object') throw new AgentValidationError('Enter column agent settings.');
  const agent = input as ColumnAgent;
  if (!statuses.includes(agent.column)) throw new AgentValidationError('Choose an existing board column.');
  if (typeof agent.name !== 'string' || !agent.name.trim()) throw new AgentValidationError('Enter an agent name.', 'name');
  if (agent.tool !== 'codex') throw new AgentValidationError('Choose Codex CLI as the execution tool.');
  if (typeof agent.model !== 'string' || !agent.model.trim()) throw new AgentValidationError('Enter a model supported by your Codex CLI account.', 'model');
  if (!effortLevels.includes(agent.effort)) throw new AgentValidationError('Choose an effort level: low, medium, high, or xhigh.');
  if (!permissionModes.includes(agent.permissions)) throw new AgentValidationError('Choose permissions: read-only, workspace-write, or danger-full-access.');
  if (typeof agent.instructions !== 'string') throw new AgentValidationError('Enter instructions as text, or leave them empty.');
  return { column: agent.column, name: agent.name.trim(), tool: 'codex', model: agent.model.trim(),
    effort: agent.effort, instructions: agent.instructions, permissions: agent.permissions };
}
