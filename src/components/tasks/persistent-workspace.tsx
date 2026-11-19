"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ConfigurationTransfer } from "./configuration-transfer";
import { WorkspaceArchive } from "./workspace-archive";
import { WorkspaceSettings } from "./workspace-settings";
import { CreateWorkspace } from "./create-workspace";
import { ExecutorSettings } from "./executor-settings";
import { ColumnSettings } from "./column-settings";
import { AgentLibrary } from "./agent-library";
import { WorkflowLibrary } from "./workflow-library";
import { TaskBoard } from "./task-board";
import type { AgentProfile, ExecutionTool, ExecutorStatus } from "@/domain/column-agent";
import {
  agentApi,
  executorApi,
  columnApi,
  taskApi,
  type BoardSnapshot,
} from "@/lib/workspace-api";

export function PersistentWorkspace({
  screen = "board",
}: {
  screen?: "board" | "agents" | "workflows" | "settings";
}) {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [agents, setAgents] = useState<AgentProfile[] | null>(null);
  const [executorStatuses, setExecutorStatuses] = useState<ExecutorStatus[]>([]);
  const [defaultExecutor, setDefaultExecutor] = useState<ExecutionTool>("codex");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading("Loading workspace…");
    Promise.all([taskApi.list(), agentApi.list(), executorApi.get(screen === "agents")])
      .then(([board, agents, settings]) => {
        if (active) {
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
      <main className="p-8" aria-busy={!failed}>
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
  const { columns, tasks } = board;
  if (screen === "workflows") return <WorkflowLibrary agents={agents} columns={columns} />;
  if (screen === "settings")
    return (
      <UrlColumnSettings
        key={attempt}
        initialColumns={columns}
        initialTaskCounts={Object.fromEntries(
          columns.map((column) => [
            column,
            tasks.filter((task) => task.status === column).length,
          ]),
        )}
        executorSettings={<ExecutorSettings />}
        generalSettings={<ConfigurationTransfer onImported={() => setAttempt((value) => value + 1)} />}
        workspaceSettings={
          <>
            <WorkspaceSettings />
            <CreateWorkspace />
            <WorkspaceArchive />
          </>
        }
        {...columnApi}
      />
    );
  if (screen === "agents")
    return (
      <AgentLibrary
        defaultExecutor={defaultExecutor}
        executorStatuses={executorStatuses}
        initialAgents={agents}
        persistence={agentApi}
      />
    );
  return (
    <TaskBoard
      columns={columns}
      initialMigration={board.migration}
      initialTasks={tasks}
      initialAgents={agents}
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
