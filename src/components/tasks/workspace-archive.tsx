"use client";

import { useEffect, useState } from "react";
import type { Workspace } from "@/domain/workspace";
import { workspaceApi } from "@/lib/workspace-api";
import { selectedWorkspaceId } from "@/lib/workspace-fetch";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { notifyOperation, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function WorkspaceArchive({ allowArchive = true, allowRestore = true, onBusyChange }: { allowArchive?: boolean; allowRestore?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [archived, setArchived] = useState<Workspace[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!allowRestore) return;
    let active = true;
    workspaceApi.archived().then((items) => { if (active) { setArchived(items); setError(""); } })
      .catch((error) => { if (active) { setError(error.message); toast.error(error.message); } });
    return () => { active = false; };
  }, [attempt, allowRestore]);

  async function update(id: string, archive: boolean) {
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const result = await notifyOperation(() => workspaceApi.setArchived(id, archive), { loading: archive ? "Archiving workspace…" : "Restoring workspace…", success: archive ? "Workspace archived." : "Workspace restored.", error: error => error instanceof Error ? error.message : "Could not update workspace." });
      const selected = selectedWorkspaceId();
      const next = !archive ? id : result.workspaces.find((item) => item.id === selected)?.id ?? result.workspaces[0]?.id;
      window.location.assign(`/settings?tab=workspaces${next ? `&workspace=${encodeURIComponent(next)}` : ""}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update workspace.");
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return <WorkspaceArchiveView archived={archived} error={error} busy={busy} allowArchive={allowArchive} allowRestore={allowRestore}
    onArchive={() => { const id = selectedWorkspaceId(); if (id) void update(id, true); }}
    onRestore={(id) => void update(id, false)} onRefresh={() => setAttempt((value) => value + 1)} />;
}

export function WorkspaceArchiveView({ archived, error = "", busy = false, allowArchive = true, allowRestore = true, onArchive, onRestore, onRefresh }: {
  archived: Workspace[];
  error?: string;
  busy?: boolean;
  allowArchive?: boolean;
  allowRestore?: boolean;
  onArchive: () => void;
  onRestore: (id: string) => void;
  onRefresh: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return <section className="space-y-4" aria-label="Archive and restore">
    {allowArchive && <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>Archive this workspace</Button>}
    {allowRestore && <ul className="space-y-3">
      {archived.map((workspace) => <li key={workspace.id} className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-sm"><p className="font-medium">{workspace.name}</p><p className="break-all text-muted-foreground">{workspace.path}</p></div>
        <Button variant="outline" disabled={busy} onClick={() => onRestore(workspace.id)}>Restore <span className="sr-only">{workspace.name}</span></Button>
      </li>)}
    </ul>}
    {allowRestore && !archived.length && !error && <p className="text-sm text-muted-foreground">No archived workspaces.</p>}
    {error && allowRestore && <Button variant="outline" disabled={busy} onClick={onRefresh}>Refresh archived workspaces</Button>}
    <DeleteConfirmation open={confirming} onOpenChange={setConfirming} busy={busy}
      title="Archive this workspace?" description="This workspace will be hidden from the selector. Tasks, history, configuration, and files will be preserved. You can restore it from Archived."
      confirmLabel="Archive workspace" busyLabel="Archiving…" onConfirm={onArchive} />
  </section>;
}
