"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Clock, History, LoaderCircle } from "lucide-react";
import type { RunHistoryEntry } from "@/domain/execution";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { Markdown } from "@/components/ui/markdown";
import { AgentStatus } from "./agent-status";

async function loadHistory(taskId: string, signal: AbortSignal): Promise<RunHistoryEntry[]> {
  const response = await workspaceFetch(`/api/tasks/run?${new URLSearchParams({ taskId })}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load run history.");
  return response.json();
}

export function RunHistory({ taskId, load = loadHistory }: {
  taskId: string;
  load?: typeof loadHistory;
}) {
  const [open, setOpen] = useState(false);
  return <Trace>
    <TraceCollapsible open={open} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>
        <TraceIcon><History /></TraceIcon>
        <TraceTitle>Run history</TraceTitle>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent keepMounted>
        <RunHistoryContent key={taskId} taskId={taskId} load={load} active={open} />
      </TraceCollapsibleContent>
    </TraceCollapsible>
  </Trace>;
}

function RunHistoryContent({ taskId, load, active }: { taskId: string; load: typeof loadHistory; active: boolean }) {
  const [runs, setRuns] = useState<RunHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await load(taskId, controller.signal);
        if (!controller.signal.aborted) { setRuns(result); setError(false); }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [taskId, load, attempt, active]);

  return <Trace>
    {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      Could not refresh run history.
      <Button type="button" size="sm" variant="ghost-muted" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
    </div>}
    {!runs && !error && <p role="status" className="text-sm text-muted-foreground">Loading runs…</p>}
    {runs?.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
    <Trace role="list" aria-label="Agent runs">
      {runs?.map((run) => {
        const status = run.status === "Running" ? "running" : ["Failed", "Blocked", "Interrupted"].includes(run.status) ? "error" : ["Queued", "Waiting", "Paused", "Not started"].includes(run.status) ? "pending" : "complete";
        const Icon = status === "running" ? LoaderCircle : status === "error" ? CircleX : status === "pending" ? Clock : CircleCheck;
        return <Trace role="listitem" key={run.id}>
          <TraceLine status={status}>
            <TraceIcon><Icon className={status === "running" ? "animate-spin motion-reduce:animate-none" : undefined} /></TraceIcon>
            <TraceTitle>{run.agentName}</TraceTitle>
            <AgentStatus status={run.status} />
          </TraceLine>
          <TraceDescription>
            <p>{run.finishedAt ? "Finished" : run.startedAt ? "Started" : "Queued"}{" "}
              <time dateTime={run.finishedAt ?? run.startedAt ?? run.createdAt}>
                {new Date(run.finishedAt ?? run.startedAt ?? run.createdAt).toLocaleString()}
              </time>
            </p>
            {run.summary && <TraceCollapsible>
              <TraceCollapsibleTrigger size="xs">View summary</TraceCollapsibleTrigger>
              <TraceCollapsibleContent keepMounted><Markdown>{run.summary}</Markdown></TraceCollapsibleContent>
            </TraceCollapsible>}
          </TraceDescription>
        </Trace>;
      })}
    </Trace>
  </Trace>;
}
