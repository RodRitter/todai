"use client";
import { useEffect, useState } from "react";
import { formatCredits } from "@/lib/usage-format";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { usageLabels, type TaskUsageOverview as UsageData, type UsageKind, type UsageTotals } from "@/domain/usage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UsageMetrics, UsageBreakdown, ModelUsageBreakdown, UsageNote } from "@/components/ui/usage-metrics";

async function loadUsage(taskId: string, signal: AbortSignal): Promise<UsageData> {
  const response = await workspaceFetch(`/api/tasks/usage?${new URLSearchParams({ taskId })}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load task usage.");
  return response.json();
}
function tokenValue(totals: UsageTotals, value = totals.tokens) {
  return totals.calls && !totals.measured ? (totals.pending ? "Pending" : "Unknown") : value.toLocaleString();
}
function creditValue(totals: UsageTotals) {
  return totals.calls && !totals.priced ? (totals.pending ? "Pending" : "Unavailable") : formatCredits(totals.credits);
}
export function TaskUsage({ taskId, active, load = loadUsage, onCreditsChange }: { taskId: string; active: boolean; load?: typeof loadUsage; onCreditsChange?: (credits: string | null) => void }) {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const next = await load(taskId, controller.signal); if (!controller.signal.aborted) { setData(next); setError(false); onCreditsChange?.(next.totals.calls && !next.totals.priced ? null : formatCredits(next.totals.credits)); } }
      catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted && active) timer = setTimeout(refresh, 3000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [taskId, active, load, attempt, onCreditsChange]);
  const incomplete = data && (data.totals.unknown + data.totals.unpriced + data.totals.pending > 0);
  return <div className="space-y-6">
    {error && <p role="alert">Could not refresh task usage. <Button type="button" size="sm" variant="ghost-muted" onClick={() => setAttempt(value => value + 1)}>Retry</Button></p>}
    {!data && !error && <p role="status">Loading usage…</p>}
    {data && <>
      <UsageMetrics items={[
        { label: "Recorded tokens", value: tokenValue(data.totals), hint: `Tracking started ${new Date(data.trackingSince).toLocaleString()}. Earlier private chat and draft imports are excluded. Only usage reported by Codex is included.` },
        { label: "Estimated credits", value: creditValue(data.totals), hint: "Published Standard rates. This estimate does not establish billed charges or credit deductions. Unknown model rates are excluded." },
        { label: "Codex calls", value: data.totals.calls.toLocaleString() },
      ]} />
      {incomplete && <UsageNote label={data.totals.unknown || data.totals.unpriced ? "Partial totals" : "Usage pending"} hint={`${data.totals.pending} pending calls; ${data.totals.unknown} calls with unknown or incomplete counts; ${data.totals.unpriced} calls without credit rates. Known usage is included.`} />}
      {!data.totals.calls ? <p>No Codex usage yet.</p> : <>
        <UsageMetrics items={[
          { label: "Uncached input", value: tokenValue(data.totals, data.totals.uncachedInput) },
          { label: "Cached input", value: tokenValue(data.totals, data.totals.cachedInput) },
          { label: "Output", value: tokenValue(data.totals, data.totals.output), hint: "Output includes reasoning tokens. Reasoning is not counted again." },
        ]} />
        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList aria-label="Usage breakdown"><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="model">Model</TabsTrigger></TabsList>
          <TabsContent value="activity" forceMount>
        <UsageBreakdown rows={(Object.entries(data.groups) as [UsageKind, UsageData["totals"]][]).map(([kind, totals]) => ({
          label: usageLabels[kind], calls: totals.calls.toLocaleString(), tokens: tokenValue(totals), credits: creditValue(totals),
        }))} />
          </TabsContent>
          <TabsContent value="model" forceMount>
            <ModelUsageBreakdown rows={data.models.map(({ model, effort, totals }) => ({
              model, effort: effort ?? "Unknown", tokens: tokenValue(totals), credits: creditValue(totals),
              input: tokenValue(totals, totals.uncachedInput), cached: tokenValue(totals, totals.cachedInput), output: tokenValue(totals, totals.output),
            }))} />
          </TabsContent>
        </Tabs>
      </>}
    </>}
  </div>;
}
