"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, LoaderCircle, Pause } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import type { ExecutionState } from "@/domain/execution";

export function ExecutionActivity() {
  const [state, setState] = useState<ExecutionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const version = requestVersion.current;
      try {
        const response = await fetch("/api/execution", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not read execution status.");
        const snapshot: ExecutionState = await response.json();
        if (active && version === requestVersion.current) setState(snapshot);
      } catch {
        if (active && version === requestVersion.current) setState(null);
      } finally {
        if (active) timer = setTimeout(refresh, 1000);
      }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, []);

  async function act(action: "stop" | "resume") {
    requestVersion.current++;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/execution", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "stop" ? { runId: state?.active?.runId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update execution.");
      setState(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update execution.");
    } finally { requestVersion.current++; setBusy(false); }
  }

  return <ExecutionActivityView state={state} error={error} busy={busy} onAction={act} />;
}

export function ExecutionActivityView({ state, error = null, busy = false, onAction }: {
  state: ExecutionState | null;
  error?: string | null;
  busy?: boolean;
  onAction: (action: "stop" | "resume") => void;
}) {
  const label = !state ? "Execution unavailable" : state.active?.stopping ? "Stopping" : state.active ? "Running" : state.paused ? "Paused" : "Idle";
  const Icon = state?.active ? LoaderCircle : state?.paused ? Pause : Circle;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Execution: ${label}`}>
          <Icon className={state?.active ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} aria-label="Global execution" className="z-50 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-md border bg-popover p-4 text-sm text-popover-foreground shadow-md">
          <h2 className="font-semibold">Global execution</h2>
          {!state ? <p role="status">Checking execution status…</p> : <>
            {state.active ? <div className="space-y-1 break-words">
              <p className="font-medium">{state.active.agentName}</p>
              <p>{state.active.taskTitle}</p>
              <p className="text-xs text-muted-foreground">{state.active.workspaceName}</p>
              <p className="break-all text-xs text-muted-foreground">{state.active.workspacePath}</p>
            </div> : <p>No agent is running.</p>}
            <p className="text-xs text-muted-foreground">{state.paused
              ? "The queue is paused across all workspaces. Stopped tasks need a new Run request; resuming the queue does not restart them."
              : "Stopping a run preserves saved work and pauses the queue across all workspaces."}</p>
            {state.active && <Button size="sm" variant="destructive" disabled={busy || state.active.stopping} onClick={() => onAction("stop")}>
              {state.active.stopping ? "Stopping…" : "Stop current run"}
            </Button>}
            {state.paused && <Button size="sm" variant="outline" disabled={busy || Boolean(state.active?.stopping)} onClick={() => onAction("resume")}>Resume queue</Button>}
          </>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
