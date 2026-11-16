"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { WorkspaceSettings } from "./workspace-settings";
import { ColumnSettings } from "./column-settings";
import { AgentLibrary } from "./agent-library";
import { TaskBoard } from "./task-board";
import type { AgentProfile } from "@/domain/column-agent";
import {
  agentApi,
  columnApi,
  taskApi,
  type BoardSnapshot,
} from "@/lib/workspace-api";

export function PersistentWorkspace({
  screen = "board",
}: {
  screen?: "board" | "agents" | "settings";
}) {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [agents, setAgents] = useState<AgentProfile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading("Loading workspace…");
    Promise.all([taskApi.list(), agentApi.list()])
      .then(([board, agents]) => {
        if (active) {
          setBoard(board);
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
  }, [attempt]);
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
  const { columns, tasks, assignments } = board;
  if (screen === "settings")
    return (
      <ColumnSettings
        initialColumns={columns}
        initialTaskCounts={Object.fromEntries(
          columns.map((column) => [
            column,
            tasks.filter((task) => task.status === column).length,
          ]),
        )}
        workspaceSettings={<WorkspaceSettings />}
        {...columnApi}
      />
    );
  if (screen === "agents")
    return (
      <AgentLibrary
        initialAgents={agents}
        initialAssignments={assignments}
        persistence={agentApi}
      />
    );
  return (
    <TaskBoard
      columns={columns}
      initialTasks={tasks}
      initialAgents={agents}
      initialAssignments={assignments}
      saveAgent={agentApi.save}
      assignAgent={agentApi.assign}
      persistence={taskApi}
    />
  );
}
