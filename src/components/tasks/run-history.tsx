"use client";

import { useEffect, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import type { RunHistoryEntry } from "@/domain/execution";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  return <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
    <CollapsibleTrigger asChild>
      <Button type="button" variant="ghost" className="group h-auto w-full justify-start gap-2 px-3 py-3 text-muted-foreground">
        <History aria-hidden="true" className="size-4" />
        <span className="flex-1 text-left">Run history</span>
        <ChevronRight aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {open && <RunHistoryContent key={taskId} taskId={taskId} load={load} />}
    </CollapsibleContent>
  </Collapsible>;
}

function RunHistoryContent({ taskId, load }: { taskId: string; load: typeof loadHistory }) {
  const [runs, setRuns] = useState<RunHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
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
  }, [taskId, load, attempt]);

  return <div className="space-y-3 px-3 pb-3">
    {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      Could not refresh run history.
      <Button type="button" size="sm" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
    </div>}
    {!runs && !error && <p role="status" className="text-sm text-muted-foreground">Loading runs…</p>}
    {runs?.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
    <ol aria-label="Agent runs" className="ml-2 border-l border-border">
      {runs?.map((run) => <li key={run.id} className="relative py-2 pl-4 before:absolute before:top-4 before:-left-1 before:size-2 before:rounded-full before:bg-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-words text-sm font-medium">{run.agentName}</span>
          <AgentStatus status={run.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {run.finishedAt ? "Finished" : run.startedAt ? "Started" : "Queued"}{" "}
          <time dateTime={run.finishedAt ?? run.startedAt ?? run.createdAt}>
            {new Date(run.finishedAt ?? run.startedAt ?? run.createdAt).toLocaleString()}
          </time>
        </p>
        {run.summary && <details className="mt-2 text-sm">
          <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">View summary</summary>
          <div className="mt-3 min-w-0"><Markdown>{run.summary}</Markdown></div>
        </details>}
      </li>)}
    </ol>
  </div>;
}
