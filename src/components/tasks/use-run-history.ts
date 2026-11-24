"use client";

import { useEffect, useState } from "react";
import type { RunHistoryEntry } from "@/domain/execution";
import { workspaceFetch } from "@/lib/workspace-fetch";

export async function loadRunHistory(taskId: string, signal: AbortSignal): Promise<RunHistoryEntry[]> {
  const response = await workspaceFetch(`/api/tasks/run?${new URLSearchParams({ taskId })}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load agent activity.");
  return response.json();
}

export function useRunHistory(taskId: string | undefined, active: boolean, revision: unknown, load = loadRunHistory) {
  const [state, setState] = useState<{ taskId?: string; runs: RunHistoryEntry[]; error: boolean }>({ runs: [], error: false });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!active || !taskId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let interval = 1000;
    async function refresh() {
      try {
        const runs = await load(taskId!, controller.signal);
        interval = runs.some(run => run.status === "Running" || run.status === "Queued") ? 1000 : 3000;
        if (!controller.signal.aborted) setState({ taskId, runs, error: false });
      } catch {
        if (!controller.signal.aborted) setState(previous => ({ taskId, runs: previous.taskId === taskId ? previous.runs : [], error: true }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, interval);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [taskId, active, revision, load, attempt]);
  return { runs: state.taskId === taskId ? state.runs : [], error: state.taskId === taskId && state.error, retry: () => retry(value => value + 1) };
}
