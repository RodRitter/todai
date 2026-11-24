"use client";

import { Markdown } from "@/components/ui/markdown";
import { Trace, TraceCollapsible, TraceCollapsibleTrigger, TraceCollapsibleContent, TraceDescription, TraceTitle } from "@/components/ui/trace";
import type { MemoryChange, MemoryEntry } from "@/domain/memory";

export function MemoryEntryDetails({ entry }: { entry: MemoryEntry }) {
  return <div className="space-y-2">
    <Markdown>{entry.statement}</Markdown>
    <Markdown>{`Scope: ${entry.scope}\n\nSource: ${entry.source}`}</Markdown>
    <TraceDescription>{entry.category} · Revision {entry.revision}</TraceDescription>
  </div>;
}

export function MemoryChangePreview({ changes }: { changes: MemoryChange[] }) {
  return <Trace>
    {changes.map((change) => {
      const entry = (change.after ?? change.before)!;
      const label = { add: "Add", update: "Change", remove: "Remove" }[change.operation];
      return <div key={entry.id} className="space-y-2">
        <TraceTitle>{label} — {entry.title}</TraceTitle>
        <Markdown>{entry.statement}</Markdown>
        <TraceDescription><Markdown>{`Scope: ${entry.scope}`}</Markdown></TraceDescription>
        <TraceCollapsible>
          <TraceCollapsibleTrigger aria-label={`Details: ${entry.title}`}>Details</TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <Markdown>{change.reason}</Markdown>
            {change.before && <div className="space-y-2"><TraceTitle>Before</TraceTitle><MemoryEntryDetails entry={change.before} /></div>}
            {change.after && <div className="space-y-2"><TraceTitle>After</TraceTitle><MemoryEntryDetails entry={change.after} /></div>}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </div>;
    })}
  </Trace>;
}
