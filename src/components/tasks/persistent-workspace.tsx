"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { GeneralSettings } from "./general-settings";
import { ConfigurationTransfer } from "./configuration-transfer";
import { WorkspaceSettingsTab } from "./workspace-settings-tab";
import { ExecutorSettings } from "./executor-settings";
import { ColumnSettings } from "./column-settings";
import { AgentLibrary } from "./agent-library";
import { BoardSettings } from "./board-settings";
import type { Board } from "@/domain/task";
import { selectedBoardId } from "@/lib/workspace-fetch";
import { TaskBoard } from "./task-board";
import type { AgentProfile, ExecutionTool, ExecutorStatus } from "@/domain/column-agent";
import {
  boardApi,
  agentApi,
  executorApi,
  columnApi,
  taskApi,
  type BoardSnapshot,
} from "@/lib/workspace-api";

export function PersistentWorkspace({
  screen = "board",
}: {
  screen?: "board" | "agents" | "settings";
}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [allAssignments, setAllAssignments] = useState<(import("@/domain/column-agent").ColumnAssignment & { boardName?: string })[]>([]);
  const [agents, setAgents] = useState<AgentProfile[] | null>(null);
  const [executorStatuses, setExecutorStatuses] = useState<ExecutorStatus[]>([]);
  const [defaultExecutor, setDefaultExecutor] = useState<ExecutionTool>("codex");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading("Loading workspace…");
    Promise.all([taskApi.list(), agentApi.list(), executorApi.get(screen === "agents"), boardApi.list(), screen === "agents" ? agentApi.assignments() : Promise.resolve([])])
      .then(([board, agents, settings, boards, assignments]) => {
        if (active) {
          setAllAssignments(assignments);
          setBoards(boards);
          setBoard(board);
          setDefaultExecutor(settings.defaultExecutor);
          setExecutorStatuses(settings.statuses ?? []);
          setAgents(agents);
          toast.dismiss(id);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          toast.error(
            "Could not load the board. Check local database access and try again.",
            { id, duration: Infinity },
          );
        }
      });
    return () => {
      active = false;
      toast.dismiss(id);
    };
  }, [attempt, screen]);
  if (!board || !agents)
    return (
      <main className="p-4 md:p-8" aria-busy={!failed}>
        {failed && (
          <Button
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry loading workspace
          </Button>
        )}
      </main>
    );
  const { columns, tasks, assignments } = board;
  if (screen === "settings")
    return (
      <UrlColumnSettings
        key={attempt}
        boardSettings={<BoardSettings boards={boards} />}
        initialColumns={columns}
        initialTaskCounts={Object.fromEntries(
          columns.map((column) => [
            column,
            tasks.filter((task) => task.status === column).length,
          ]),
        )}
        executorSettings={<ExecutorSettings />}
        generalSettings={<><GeneralSettings /><ConfigurationTransfer onImported={() => setAttempt((value) => value + 1)} /></>}
        workspaceSettings={<WorkspaceSettingsTab />}
        {...columnApi}
      />
    );
  if (screen === "agents")
    return (
      <AgentLibrary
        defaultExecutor={defaultExecutor}
        executorStatuses={executorStatuses}
        initialAgents={agents}
        initialAssignments={allAssignments}
        persistence={agentApi}
      />
    );
  return (
    <TaskBoard
      boards={boards}
      boardId={selectedBoardId()}
      columns={columns}
      initialTasks={tasks}
      initialAgents={agents}
      initialAssignments={assignments}
      initialColumnInstructions={board.columnInstructions}
      initialCompletionColumn={board.completionColumn}
      initialTaskId={typeof window === "undefined" ? undefined : new URL(window.location.href).searchParams.get("task") ?? undefined}
      configureColumn={columnApi.rename}
      assignAgent={agentApi.assign}
      persistence={taskApi}
    />
  );
}

function UrlColumnSettings(props: ComponentProps<typeof ColumnSettings>) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab === "board" || requestedTab === "executors" || requestedTab === "workspaces" ? requestedTab : "general";

  return (
    <ColumnSettings
      {...props}
      tab={tab}
      onTabChange={(value) => {
        if (value === tab) return;
        const url = new URL(window.location.href);
        url.searchParams.set("tab", value);
        window.history.pushState(null, "", url);
      }}
    />
  );
}
