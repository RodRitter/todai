"use client";
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import type { WorkspaceCredits } from "@/domain/usage";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverBody } from "@/components/ui/popover";
import { TokenCreditBreakdown, UsageNote } from "@/components/ui/usage-metrics";
import { formatCredits } from "@/lib/usage-format";
async function loadCredits(signal: AbortSignal): Promise<WorkspaceCredits> {
  const response = await workspaceFetch("/api/usage", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load tracked credits.");
  return response.json();
}
export function TrackedCredits({ load = loadCredits }: { load?: typeof loadCredits }) {
  const [data, setData] = useState<WorkspaceCredits | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await load(controller.signal);
        if (!controller.signal.aborted) { setData(next); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 3000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);
  const value = data && (!data.calls || data.priced) ? formatCredits(data.credits) : "—";
  const tokens = data ? Object.values(data.breakdown).reduce((sum, row) => sum + row.tokens, 0) : 0;
  return <Popover><PopoverTrigger asChild>
    <Button type="button" variant="ghost-muted" size="sm" aria-label={`${value} tracked credits${failed ? ", refresh unavailable" : ""}`}>
      <Coins aria-hidden="true" />{value}
    </Button>
  </PopoverTrigger><PopoverContent size="wide" layout="sections" aria-label="Workspace usage">
    <PopoverHeader>Workspace usage</PopoverHeader>
    <PopoverBody>
    {failed && <p role="alert">Could not refresh usage.</p>}
    {!data && !failed && <p role="status">Loading usage…</p>}
    {data && <>
      <TokenCreditBreakdown rows={[
        ...([['uncachedInput', 'Uncached input'], ['cachedInput', 'Cached input'], ['output', 'Output']] as const).map(([key, label]) => ({
          label, tokens: data.calls && !data.measured ? "Unknown" : data.breakdown[key].tokens.toLocaleString(),
          credits: data.calls && !data.priced ? "Unavailable" : formatCredits(data.breakdown[key].credits),
        })),
        { label: "Total", tokens: data.calls && !data.measured ? "Unknown" : tokens.toLocaleString(), credits: value },
      ]} />
      {(data.priced < data.calls || data.measured < data.calls) && <UsageNote label="Partial totals" />}
    </>}
    </PopoverBody>
  </PopoverContent></Popover>;
}
