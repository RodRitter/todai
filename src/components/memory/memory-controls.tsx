"use client";

import { useState } from "react";
import type { MemoryEntry } from "@/domain/memory";
import { memoryApi } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { notifyOperation, toast } from "@/components/ui/toast";
import { Markdown } from "@/components/ui/markdown";
import { MemoryEntryDetails } from "./memory-preview";

export function MemoryControls({ entry, onChange, change = memoryApi.change, history = memoryApi.history }: {
  entry: MemoryEntry; onChange: () => void;
  change?: typeof memoryApi.change; history?: typeof memoryApi.history;
}) {
  const [editing, setEditing] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(entry);
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof history>> | null>(null);
  async function save(operation: "update" | "remove", needsReview = draft.needsReview, value = draft) {
    if (busy) return;
    setBusy(true);
    try {
      await notifyOperation(() => change({ ...value, operation, needsReview, reason: operation === "remove" ? "Retired by the user." : "Updated by the user." }), {
        loading: "Updating memory…", success: "Memory updated.", error: (error) => error instanceof Error ? error.message : "Could not update memory.",
      });
      setEditing(false); setRetiring(false); onChange();
    } catch { /* The toast reports the failure. */ }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy || entry.retired} onClick={() => { setDraft(entry); setEditing(true); }}>Correct</Button>
      <Button variant="ghost" size="sm" disabled={busy || entry.retired} onClick={() => void save("update", !entry.needsReview, entry)}>{entry.needsReview ? "Mark reviewed" : "Mark for review"}</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={async () => {
        setBusy(true);
        try { setVersions(await history(entry.id)); } catch { toast.error("Could not load memory history. Try again."); }
        finally { setBusy(false); }
      }}>History</Button>
      <Button variant="ghost-destructive" size="sm" disabled={busy || entry.retired} onClick={() => setRetiring(true)}>Retire</Button>
    </div>
    <Dialog open={editing} onOpenChange={(open) => { if (!busy) setEditing(open); }}>
      <DialogContent closeDisabled={busy}>
        <DialogHeader><DialogTitle>Correct memory</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save("update"); }}>
          {(["title", "statement", "details", "scope", "source"] as const).map((field) => <div key={field} className="space-y-2">
            <Label htmlFor={`memory-${entry.id}-${field}`}>{({ title: "Title", statement: "Summary", details: "Details and evidence", scope: "Scope", source: "Source" })[field]}</Label>
            {field === "details" || field === "statement" ? <Textarea id={`memory-${entry.id}-${field}`} disabled={busy} required={field === "statement"} maxLength={field === "details" ? 12000 : 600} value={draft[field] ?? ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /> :
              <Input id={`memory-${entry.id}-${field}`} disabled={busy} required maxLength={field === "title" ? 100 : field === "scope" ? 160 : 500} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />}
          </div>)}
          <Button type="submit" size="sm" disabled={busy}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
    <DeleteConfirmation open={retiring} onOpenChange={setRetiring} title="Retire memory?" description="Remove this record from search and task context. Its saved versions remain in history." busy={busy} onConfirm={() => void save("remove", entry.needsReview, entry)} confirmLabel="Retire" busyLabel="Retiring…" />
    <Dialog open={versions !== null} onOpenChange={(open) => { if (!open) setVersions(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Memory history</DialogTitle></DialogHeader>
        {versions?.length ? versions.map((version) => <div key={version.entry.revision} className="space-y-2"><MemoryEntryDetails entry={version.entry} /><Markdown>{version.reason}</Markdown></div>) : <Markdown>No saved changes exist for this record.</Markdown>}
      </DialogContent>
    </Dialog>
  </div>;
}
