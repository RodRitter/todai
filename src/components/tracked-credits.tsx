"use client";
import { useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";
import type { WorkspaceCredits } from "@/domain/usage";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverBody } from "@/components/ui/popover";
import { CreditPercentageBadge, TokenCreditBreakdown, UsageNote } from "@/components/ui/usage-metrics";
import { formatCredits } from "@/lib/usage-format";
async function loadCredits(signal: AbortSignal): Promise<WorkspaceCredits> {
  const response = await workspaceFetch("/api/usage", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load tracked credits.");
  return response.json();
}
async function resetCredits(): Promise<WorkspaceCredits> {
  const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credits: 0 }) });
  if (!response.ok) throw new Error("Could not reset tracked credits.");
  return response.json();
}
export function TrackedCredits({ load = loadCredits, reset = resetCredits }: { load?: typeof loadCredits; reset?: typeof resetCredits }) {
  const revision = useRef(0);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
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
  const value = data && (!data.calls || data.priced) ? formatCredits(data.credits) : "—";
  const current = data?.trackedCredits ?? data?.credits;
  const display = current === undefined ? "—" : formatCredits(current);
  const limit = data?.creditLimit ?? 0;
  const headerValue = limit > 0 ? `${display} / ${formatCredits(limit)}` : display;
  const percentage = current !== undefined && limit > 0 ? current / limit * 100 : null;
  const tokens = data ? Object.values(data.breakdown).reduce((sum, row) => sum + row.tokens, 0) : 0;
  return <Popover><PopoverTrigger asChild>
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
    {resetError && <p role="alert">{resetError}</p>}
    <Button type="button" variant="outline" size="sm" disabled={!data || resetting} onClick={async () => {
      revision.current += 1;
      setResetting(true); setResetError("");
      try { const next = await reset(); revision.current += 1; setData(next); } catch { setResetError("Could not reset tracked credits."); }
      finally { setResetting(false); }
    }}>{resetting ? "Resetting…" : "Reset tracking"}</Button>
    </PopoverBody>
  </PopoverContent></Popover>;
}
