export type QueuedDirectoryChange = { runId: string; workspaceName: string; previousPath: string; path: string };

export type ExecutionState = {
  paused: boolean;
  directoryChanges?: QueuedDirectoryChange[];
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
