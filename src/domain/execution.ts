export type QueuedDirectoryChange = { runId: string; workspaceName: string; previousPath: string; path: string };

export type RunHistoryEntry = {
  id: string;
  agentName: string;
  status: "Queued" | "Running" | "Complete" | "Failed" | "Interrupted" | "Stopped" | "Waiting";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
};

export type QueuedRun = {
  runId: string;
  taskTitle: string;
  agentName: string;
  workspaceName: string;
  held: boolean;
};

export type ExecutionState = {
  paused: boolean;
  queued?: QueuedRun[];
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
