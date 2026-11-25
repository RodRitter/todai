import type { ExecutionTool, AgentProfile } from "./column-agent.ts";

export type ChatModel = { tool: ExecutionTool; model: string; effort: AgentProfile["effort"] };
export type WorkspaceChatMessage = {
  id: string; authorRole: "human" | "agent"; authorName: string; body: string; createdAt: string;
  model?: string; effort?: AgentProfile["effort"];
};
export type WorkspaceChatActivity = {
  id: string; turnId: string; name: string; input: Record<string, unknown>;
  status: "running" | "complete" | "error"; result?: unknown; mutation: boolean;
};
export type WorkspaceChatSummary = ChatModel & {
  id: string; title: string; createdAt: string; updatedAt: string; running: boolean; error: string | null;
};
export type WorkspaceChat = WorkspaceChatSummary & {
  messages: WorkspaceChatMessage[]; activities: WorkspaceChatActivity[];
};
