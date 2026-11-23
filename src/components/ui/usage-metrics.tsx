"use client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";
import { Card, CardContent } from "./card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
function UsageLabel({ label, hint }: { label: string; hint?: string }) {
  if (!hint) return <>{label}</>;
  return <TooltipProvider><Tooltip>
    <TooltipTrigger className="cursor-help rounded-sm text-left underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{label}</TooltipTrigger>
    <TooltipContent>{hint}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
/** Summary values lead the page; supporting values use a quiet, compact row. */
export function UsageMetrics({ items, variant = "detail" }: {
  items: { label: string; value: string; hint?: string }[];
  variant?: "summary" | "detail";
}) {
  if (variant === "detail") return <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
    {items.map(item => <div key={item.label} className="min-w-0">
      <dt className="text-xs text-muted-foreground"><UsageLabel label={item.label} hint={item.hint} /></dt>
      <dd className="mt-1.5 break-words text-sm font-medium tabular-nums">{item.value}</dd>
    </div>)}
  </dl>;
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {items.map(item => <Card key={item.label} elevation="flat" tone="muted">
      <CardContent><dl>
        <dt className="text-sm font-medium text-muted-foreground"><UsageLabel label={item.label} hint={item.hint} /></dt>
        <dd className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{item.value}</dd>
      </dl></CardContent>
    </Card>)}
  </div>;
}
export function UsageNote({ label, hint }: { label: string; hint?: string }) {
  return <div role="status" className="text-xs text-muted-foreground"><UsageLabel label={label} hint={hint} /></div>;
}
function UsageTable({ label, columns, rows, textColumns = 1, density = "default" }: { label: string; columns: string[]; rows: string[][]; textColumns?: number; density?: "default" | "compact" }) {
  return <ScrollArea orientation="both" className="max-h-96" viewportProps={{ "aria-label": label }}>
    <table aria-label={label} className="w-full text-left text-sm tabular-nums">
      <thead className="text-xs text-muted-foreground"><tr>{columns.map((column, index) => <th key={column} scope="col" className={index < textColumns ? "whitespace-nowrap px-2 pb-2 text-left font-normal first:pl-0" : "whitespace-nowrap px-2 pb-2 text-right font-normal last:pr-0"}>{column}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={JSON.stringify(row.slice(0, textColumns))} className="border-t border-border/40">{row.map((value, index) => index === 0
        ? <th key={columns[index]} scope="row" className={cn("whitespace-nowrap pr-2 font-normal", density === "compact" ? "py-1" : "py-3")}>{value}</th>
        : <td key={columns[index]} className={cn("whitespace-nowrap px-2", density === "compact" ? "py-1" : "py-3", index < textColumns ? "text-left" : "text-right last:pr-0")}>{value}</td>)}</tr>)}</tbody>
    </table>
  </ScrollArea>;
}
export function UsageBreakdown({ rows }: { rows: { label: string; calls: string; tokens: string; credits: string }[] }) {
  return <UsageTable label="Usage by activity" columns={["Activity", "Calls", "Tokens", "Credits"]} rows={rows.map(row => [row.label, row.calls, row.tokens, row.credits])} />;
}
export function ModelUsageBreakdown({ rows }: { rows: { model: string; effort: string; input: string; cached: string; output: string; tokens: string; credits: string }[] }) {
  return <UsageTable label="Usage by model and effort" textColumns={2} columns={["Model", "Effort", "Uncached input", "Cached input", "Output", "Tokens", "Credits"]} rows={rows.map(row => [row.model, row.effort, row.input, row.cached, row.output, row.tokens, row.credits])} />;
}
export function TokenCreditBreakdown({ rows, density = "default" }: { rows: { label: string; tokens: string; credits: string }[]; density?: "default" | "compact" }) {
  return <UsageTable density={density} label="Workspace token and credit breakdown" columns={["Token type", "Tokens", "Est. credits"]} rows={rows.map(row => [row.label, row.tokens, row.credits])} />;
}

export function CreditPercentageBadge({ percentage }: { percentage: number }) {
  return <span data-slot="credit-percentage" className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${percentage > 80 ? "bg-destructive text-white" : "bg-muted text-muted-foreground"}`}>
    {Number(percentage.toFixed(2))}%
  </span>;
}
