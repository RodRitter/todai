"use client";
import { ScrollArea } from "./scroll-area";
import { Info } from "lucide-react";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
function Help({ label, hint }: { label: string; hint: string }) {
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><Button type="button" size="icon-xs" variant="ghost-muted" aria-label={`About ${label}`}><Info /></Button></TooltipTrigger><TooltipContent>{hint}</TooltipContent></Tooltip></TooltipProvider>;
}
/** Shared presentation for compact usage values and their labels. */
export function UsageMetrics({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {items.map(item => <Card key={item.label} variant="compact" elevation="flat">
      <CardContent><dl>
        <dt className="flex min-h-7 items-center gap-1 text-xs text-muted-foreground">{item.label}{item.hint && <Help label={item.label} hint={item.hint} />}</dt>
        <dd className="mt-1 break-words text-lg font-medium tabular-nums">{item.value}</dd>
      </dl></CardContent>
    </Card>)}
  </div>;
}
export function UsageNote({ label, hint }: { label: string; hint?: string }) {
  return <div role="status" className="flex items-center gap-1 text-xs text-muted-foreground">{label}{hint && <Help label={label} hint={hint} />}</div>;
}
function UsageTable({ label, columns, rows, textColumns = 1 }: { label: string; columns: string[]; rows: string[][]; textColumns?: number }) {
  return <ScrollArea orientation="both" className="max-h-96" viewportProps={{ "aria-label": label }}>
    <table aria-label={label} className="w-full text-left text-sm tabular-nums">
      <thead className="text-xs text-muted-foreground"><tr>{columns.map((column, index) => <th key={column} scope="col" className={index < textColumns ? "whitespace-nowrap px-2 pb-2 text-left font-normal first:pl-0" : "whitespace-nowrap px-2 pb-2 text-right font-normal last:pr-0"}>{column}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={JSON.stringify(row.slice(0, textColumns))} className="border-t border-border/40">{row.map((value, index) => index === 0
        ? <th key={columns[index]} scope="row" className="whitespace-nowrap py-3 pr-2 font-normal">{value}</th>
        : <td key={columns[index]} className={index < textColumns ? "whitespace-nowrap px-2 py-3 text-left" : "whitespace-nowrap px-2 py-3 text-right last:pr-0"}>{value}</td>)}</tr>)}</tbody>
    </table>
  </ScrollArea>;
}
export function UsageBreakdown({ rows }: { rows: { label: string; calls: string; tokens: string; credits: string }[] }) {
  return <UsageTable label="Usage by activity" columns={["Activity", "Calls", "Tokens", "Est. credits"]} rows={rows.map(row => [row.label, row.calls, row.tokens, row.credits])} />;
}
export function ModelUsageBreakdown({ rows }: { rows: { model: string; effort: string; input: string; cached: string; output: string; tokens: string; credits: string }[] }) {
  return <UsageTable label="Usage by model and effort" textColumns={2} columns={["Model", "Effort", "Uncached input", "Cached input", "Output", "Total tokens", "Est. credits"]} rows={rows.map(row => [row.model, row.effort, row.input, row.cached, row.output, row.tokens, row.credits])} />;
}
export function TokenCreditBreakdown({ rows }: { rows: { label: string; tokens: string; credits: string }[] }) {
  return <UsageTable label="Workspace token and credit breakdown" columns={["Token type", "Tokens", "Est. credits"]} rows={rows.map(row => [row.label, row.tokens, row.credits])} />;
}
