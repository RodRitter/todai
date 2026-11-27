"use client";

import { useEffect, useRef, useState } from "react";
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
  const pending = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!allowRestore) return;
    let active = true;
    workspaceApi.archived().then((items) => { if (active) { setArchived(items); setError(""); } })
      .catch((error) => { if (active) { setError(error.message); toast.error(error.message); } });
    return () => { active = false; };
  }, [attempt, allowRestore]);

  async function update(id: string, archive: boolean) {
    if (pending.current) return;
    pending.current = true;
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
      pending.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  async function remove(id: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); onBusyChange?.(true);
    try {
      const result = await notifyOperation(() => workspaceApi.removeArchived(id), {
        loading: "Deleting workspace…", success: "Workspace permanently deleted.",
        error: error => error instanceof Error ? error.message : "Could not delete workspace.",
      });
      setArchived(result.archived);
      setError("");
      return true;
    } catch { return false; }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }

  return <WorkspaceArchiveView archived={archived} error={error} busy={busy} allowArchive={allowArchive} allowRestore={allowRestore}
    onArchive={() => { const id = selectedWorkspaceId(); if (id) void update(id, true); }}
    onDelete={remove}
    onRestore={(id) => void update(id, false)} onRefresh={() => setAttempt((value) => value + 1)} />;
}

export function WorkspaceArchiveView({ archived, error = "", busy = false, allowArchive = true, allowRestore = true, onArchive, onRestore, onRefresh, onDelete }: {
  archived: Workspace[];
  error?: string;
  busy?: boolean;
  allowArchive?: boolean;
  allowRestore?: boolean;
  onArchive: () => void;
  onRestore: (id: string) => void;
  onRefresh: () => void;
  onDelete?: (id: string) => Promise<boolean>;
}) {
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [confirming, setConfirming] = useState(false);
  return <section className="space-y-4" aria-label="Archive and restore">
    {allowArchive && <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>Archive this workspace</Button>}
    {allowRestore && <ul className="space-y-3">
      {archived.map((workspace) => <li key={workspace.id} className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 text-sm"><p className="font-medium">{workspace.name}</p><p className="break-all text-muted-foreground">{workspace.path}</p></div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => onRestore(workspace.id)}>Restore <span className="sr-only">{workspace.name}</span></Button>
          {onDelete && <Button variant="ghost-destructive" disabled={busy} onClick={() => setDeleting(workspace)}>Delete <span className="sr-only">{workspace.name}</span></Button>}
        </div>
      </li>)}
    </ul>}
    {allowRestore && !archived.length && !error && <p className="text-sm text-muted-foreground">No archived workspaces.</p>}
    {error && allowRestore && <Button variant="outline" disabled={busy} onClick={onRefresh}>Refresh archived workspaces</Button>}
    <DeleteConfirmation open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null); }} busy={busy}
      title={`Permanently delete ${deleting?.name ?? "workspace"}?`}
      description="This permanently removes the workspace and its tasks, history, chats, agents, artifacts, memory, and settings from Todai. Project files stay on disk. This action cannot be undone."
      confirmLabel="Delete permanently" onConfirm={() => { if (deleting && onDelete) void onDelete(deleting.id).then(deleted => { if (deleted) setDeleting(null); }); }} />
    <DeleteConfirmation open={confirming} onOpenChange={setConfirming} busy={busy}
      title="Archive this workspace?" description="This workspace will be hidden from the selector. Tasks, history, configuration, and files will be preserved. You can restore it from Archive."
      confirmLabel="Archive workspace" busyLabel="Archiving…" onConfirm={onArchive} />
  </section>;
}
