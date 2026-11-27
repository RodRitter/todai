"use client";
import { useEffect, useRef, useState } from "react";
import { Coins, Settings } from "lucide-react";
import type { WorkspaceCredits } from "@/domain/usage";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { WorkspaceLink } from "@/components/workspace-selection";
import { ResetCreditTrackingDialog } from "@/components/reset-credit-tracking-dialog";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverBody } from "@/components/ui/popover";
import { CreditPercentageBadge, TokenCreditBreakdown, UsageNote } from "@/components/ui/usage-metrics";
import { formatCredits } from "@/lib/usage-format";
async function loadCredits(signal: AbortSignal): Promise<WorkspaceCredits> {
  const response = await workspaceFetch("/api/usage", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load tracked credits.");
  return response.json();
}
async function setCredits(credits: number): Promise<WorkspaceCredits> {
  const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credits }) });
  if (!response.ok) throw new Error("Could not update tracked credits.");
  return response.json();
}
async function syncCredits(): Promise<WorkspaceCredits> {
  const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
  if (!response.ok) throw new Error("Could not update tracked credits.");
  return response.json();
}
const resetCredits = () => setCredits(0);
export function TrackedCredits({ load = loadCredits, reset = resetCredits, sync = syncCredits }: { load?: typeof loadCredits; reset?: typeof resetCredits; sync?: typeof setCredits }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const revision = useRef(0);
  const [resetting, setResetting] = useState(false);
  const [data, setData] = useState<WorkspaceCredits | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const startedAt = revision.current;
        const next = await load(controller.signal);
        if (!controller.signal.aborted && startedAt === revision.current) { setData(next); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 3000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);
  async function updateTracking(action: "reset" | "sync") {
    if (resetting || !data) return;
    revision.current += 1;
    setResetting(true);
    try {
      const next = await notifyOperation(() => action === "reset" ? reset() : sync(data.taskCredits ?? 0), {
        loading: action === "reset" ? "Resetting tracked credits…" : "Syncing tracked credits…",
        success: action === "reset" ? "Tracking reset to zero." : "Tracked credits synced with task total.",
        error: "Could not update tracked credits.",
      });
      revision.current += 1;
      setData(next);
      if (action === "reset") setConfirmReset(false);
    } catch { /* The toast reports the error. */ }
    finally { setResetting(false); }
  }
  const value = data && (!data.calls || data.priced) ? formatCredits(data.credits) : "—";
  const current = data?.trackedCredits ?? data?.credits;
  const display = current === undefined ? "—" : formatCredits(current);
  const limit = data?.creditLimit ?? 0;
  const headerValue = limit > 0 ? `${display} / ${formatCredits(limit)}` : display;
  const percentage = current !== undefined && limit > 0 ? current / limit * 100 : null;
  const tokens = data ? Object.values(data.breakdown).reduce((sum, row) => sum + row.tokens, 0) : 0;
  return <><Popover><PopoverTrigger asChild>
    <Button type="button" variant="ghost-muted" size="sm" aria-label={`${headerValue} tracked credits${percentage !== null ? `, ${Number(percentage.toFixed(2))}% used` : ""}${failed ? ", refresh unavailable" : ""}`}>
      <Coins aria-hidden="true" />{headerValue}
      {percentage !== null && <CreditPercentageBadge percentage={percentage} />}
    </Button>
  </PopoverTrigger><PopoverContent size="wide" layout="sections" aria-label="Workspace usage">
    <PopoverHeader>Workspace usage</PopoverHeader>
    <PopoverBody>
    {failed && <p role="alert">Could not refresh usage.</p>}
    {!data && !failed && <p role="status">Loading usage…</p>}
    {data && <>
      <TokenCreditBreakdown density="compact" rows={[
        ...([['uncachedInput', 'Uncached input'], ['cachedInput', 'Cached input'], ['output', 'Output']] as const).map(([key, label]) => ({
          label, tokens: data.calls && !data.measured ? "Unknown" : data.breakdown[key].tokens.toLocaleString(),
          credits: data.calls && !data.priced ? "Unavailable" : formatCredits(data.breakdown[key].credits),
        })),
        { label: "Total", tokens: data.calls && !data.measured ? "Unknown" : tokens.toLocaleString(), credits: value },
      ]} />
      {(data.priced < data.calls || data.measured < data.calls) && <UsageNote label="Partial totals" />}
    </>}
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!data || resetting} onClick={() => setConfirmReset(true)}>Reset</Button>
      <Button type="button" variant="ghost" size="sm" disabled={!data || resetting} onClick={() => void updateTracking("sync")} title={data ? `Use task total: ${formatCredits(data.taskCredits ?? 0)} credits` : undefined}>Sync with Tasks</Button>
      <Button variant="ghost" size="icon-sm" className="ml-auto" asChild><WorkspaceLink href="/settings" aria-label="Settings"><Settings aria-hidden="true" /></WorkspaceLink></Button>
    </div>
    </PopoverBody>
  </PopoverContent></Popover>
    <ResetCreditTrackingDialog open={confirmReset} busy={resetting} onOpenChange={setConfirmReset} onConfirm={() => void updateTracking("reset")} />
  </>;
}
