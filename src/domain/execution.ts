export type ExecutionState = {
  paused: boolean;
  active: {
    runId: string;
    taskId: string;
    taskTitle: string;
    agentName: string;
    workspaceId: string;
    workspaceName: string;
    workspacePath: string;
    stopping: boolean;
  } | null;
};
