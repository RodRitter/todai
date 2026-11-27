"use client";

import { useRef, useState } from "react";
import type { CleanupPreview, CleanupRecord } from "@/domain/workspace-cleanup";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { notifyOperation, toast } from "@/components/ui/toast";

async function request<T>(options?: RequestInit, days = 90): Promise<T> {
  const response = await workspaceFetch(`/api/workspace-cleanup${options ? "" : `?retentionDays=${days}`}`, { cache: "no-store", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not complete cleanup.");
  return result;
}
function Records({ title, records }: { title: string; records: CleanupRecord[] }) {
  return <details>
    <summary>{title} ({records.length})</summary>
    <ScrollArea className="max-h-64" viewportProps={{ tabIndex: 0, "aria-label": title }}>
      <ul className="space-y-3 py-3">
        {records.map(record => <li key={`${record.kind}:${record.id}`} className="break-words">
          <p>{record.title} ({record.kind})</p>
          <p className="text-sm text-muted-foreground">{record.id} — {record.reason}</p>
        </li>)}
      </ul>
    </ScrollArea>
  </details>;
}
export function WorkspaceCleanup({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const [days, setDays] = useState(90);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const pending = useRef(false);
  function lock(value: boolean) { pending.current = value; setBusy(value); onBusyChange?.(value); }
  async function load() {
    if (pending.current) return;
    lock(true); setPreview(null); setFailed(false);
    try {
      const result = await notifyOperation(() => request<CleanupPreview>(undefined, days), {
        loading: "Checking archived records…", success: "Cleanup preview ready.",
        error: error => error instanceof Error ? error.message : "Could not load cleanup preview.",
      });
      setPreview(result);
      if (result.blocked) toast.error(result.blocked);
    } catch { setFailed(true); } finally { lock(false); }
  }
  async function remove() {
    if (pending.current || !preview) return;
    lock(true);
    try {
      await notifyOperation(() => request({ method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: preview.retentionDays, asOf: preview.asOf, token: preview.token }) }), {
        loading: "Removing archived records…", success: "Cleanup complete. The database can reuse the freed space.",
        error: error => error instanceof Error ? error.message : "Could not complete cleanup.",
      });
    } catch { setFailed(true); }
    finally { setPreview(null); setConfirm(false); lock(false); }
  }
  return <section className="space-y-4" aria-label="Cleanup" aria-busy={busy}>
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Label htmlFor="cleanup-retention">Retention period</Label>
      </div>
      <NativeSelect id="cleanup-retention" value={days} disabled={busy}
        onChange={event => { setDays(Number(event.target.value)); setPreview(null); setFailed(false); }}>
        <option value={0}>Immediately (all current archives)</option>
        {[30, 90, 180].map(value => <option key={value} value={value}>{value} days</option>)}
      </NativeSelect>
    </div>
    <Button variant="outline" disabled={busy} onClick={load}>{failed ? "Retry cleanup preview" : "Preview cleanup"}</Button>
    {preview && <div className="space-y-3">
      <p>{preview.counts.task} tasks, {preview.counts.artifact} artifacts, and {preview.counts.memory} memories eligible for removal.</p>
      {preview.remove.length === 0 && <p>No records are eligible for cleanup.</p>}
      {preview.remove.length > 0 && <Records title="Records to remove" records={preview.remove} />}
      {preview.keep.length > 0 && <Records title="Records to keep" records={preview.keep} />}
      <Button variant="ghost-destructive" disabled={busy || !!preview.blocked || preview.remove.length === 0} onClick={() => setConfirm(true)}>Remove eligible records</Button>
    </div>}
    <DeleteConfirmation open={confirm} onOpenChange={setConfirm} title="Remove archived records?"
      description={`Permanently remove ${preview?.remove.length ?? 0} records and their associated history. This operation cannot be undone. Records needed by retained content stay available.`}
      busy={busy} disabled={!preview || !!preview.blocked} onConfirm={remove} confirmLabel="Remove permanently" busyLabel="Removing…" />
  </section>;
}
