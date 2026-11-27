"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TraceDescription } from "@/components/ui/trace";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { notifyOperation, toast } from "@/components/ui/toast";
import { memoryApi } from "@/lib/workspace-api";
import { MemoryControls } from "./memory-controls";
import { MemoryEntryDetails } from "./memory-preview";
import type { MemorySearchResult } from "@/domain/memory";

export function MemoryPage() {
  return <AppShell screen="memory"><MemoryContent /></AppShell>;
}

export function MemoryContent({ load = memoryApi.search, clear = memoryApi.clear }: { clear?: () => Promise<{ cleared: number }>; load?: (query: string, offset: number, signal?: AbortSignal, retired?: boolean) => Promise<MemorySearchResult> }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearingRef = useRef(false);
  const clearTrigger = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<MemorySearchResult | null>(null);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [openEntry, setOpenEntry] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      load(query, offset, controller.signal, includeRetired).then((data) => {
        if (controller.signal.aborted) return;
        if (offset > 0 && offset >= data.total) {
          setOffset(Math.floor(Math.max(0, data.total - 1) / 20) * 20);
          return;
        }
        setResult(data); setLoading(false);
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFailed(true); setLoading(false);
        toast.error(error instanceof Error ? error.message : "Could not load workspace memory. Try again.");
      });
    }, query ? 200 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load, query, offset, attempt, includeRetired]);

  async function clearMemory() {
    if (clearingRef.current) return;
    clearingRef.current = true;
    setClearing(true);
    try {
      await notifyOperation(clear, {
        loading: "Clearing workspace memory…", success: "Workspace memory cleared.",
        error: (error) => error instanceof Error ? error.message : "Could not clear workspace memory. Try again.",
      });
      setConfirmClear(false);
      setQuery(""); setOffset(0); setOpenEntry("");
      setResult({ entries: [], total: 0, hasMore: false });
      reload();
      requestAnimationFrame(() => clearTrigger.current?.focus());
    } catch { /* The toast reports the failure. Keep the dialog open for retry. */ }
    finally { clearingRef.current = false; setClearing(false); }
  }

  function reload() { setLoading(true); setFailed(false); setAttempt((value) => value + 1); }
  function page(next: number) { setLoading(true); setFailed(false); setOffset(next); }

  return <main className="p-4 md:p-8" aria-label="Workspace memory" aria-busy={loading}>
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium">Workspace Memory</h2>
        <Button variant="ghost" size="icon-sm" aria-label={failed ? "Retry" : "Refresh"} title={failed ? "Retry" : "Refresh"} disabled={loading || clearing} onClick={reload}><RefreshCw aria-hidden="true" /></Button>
        <Button ref={clearTrigger} variant="ghost-destructive" size="sm" className="ml-auto" disabled={loading || clearing} onClick={() => setConfirmClear(true)}>Clear memory</Button>
      </div>
      <DeleteConfirmation open={confirmClear} onOpenChange={(open) => {
        setConfirmClear(open);
        if (!open) requestAnimationFrame(() => clearTrigger.current?.focus());
      }} title="Clear workspace memory?"
        description="Delete all accepted memory and its saved versions in this workspace. Cancel pending memory reviews. Task comments remain. This cannot be undone."
        busy={clearing} onConfirm={() => void clearMemory()} confirmLabel="Clear memory" busyLabel="Clearing…" />
      <Input disabled={clearing} type="search" aria-label="Search memory" placeholder="Search memory" value={query} onChange={(event) => {
        setLoading(true); setFailed(false); setOffset(0); setOpenEntry(""); setQuery(event.target.value);
      }} />
      <Button variant="outline" size="sm" aria-pressed={includeRetired} disabled={clearing} onClick={() => { setIncludeRetired(!includeRetired); setOffset(0); reload(); }}>Include retired records</Button>
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading memory…</p>}
      {!loading && !failed && result && <>
        <TraceDescription>{result.total} {result.total === 1 ? "entry" : "entries"}{query ? " found" : " recorded"}</TraceDescription>
        {result.entries.length ? <Accordion type="single" collapsible value={openEntry} onValueChange={setOpenEntry}>
          {result.entries.map((entry) => <AccordionItem key={entry.id} value={entry.id}>
            <AccordionTrigger metadata={entry.category}>{entry.title}</AccordionTrigger>
            <AccordionContent><MemoryEntryDetails entry={entry} /><MemoryControls key={`${entry.id}-${entry.revision}`} entry={entry} onChange={reload} /></AccordionContent>
          </AccordionItem>)}
        </Accordion> : <p className="text-sm text-muted-foreground">{query ? "No matching memory entries." : "No memory has been recorded yet."}</p>}
        {(offset > 0 || result.hasMore) && <nav aria-label="Memory pages" className="flex items-center gap-2">
          <TraceDescription>{offset + 1}–{offset + result.entries.length} of {result.total}</TraceDescription>
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => page(Math.max(0, offset - 20))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={!result.hasMore} onClick={() => page(offset + 20)}>Next</Button>
        </nav>}
      </>}
    </div>
  </main>;
}
