import type { TaskComment } from "./task";

export type ChatMessage = TaskComment & { agentId?: string | null };
export type ChatSession = {
  id: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  running: boolean;
  error: string | null;
  messages: ChatMessage[];
};
