"use client";

import { useEffect, useState } from "react";
import type { Workspace } from "@/domain/workspace";
import { workspaceApi } from "@/lib/workspace-api";
import { selectedWorkspaceId } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";

export function WorkspaceArchive({ allowArchive = true }: { allowArchive?: boolean }) {
  const [archived, setArchived] = useState<Workspace[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    workspaceApi.archived().then((items) => { if (active) { setArchived(items); setError(""); } })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [attempt]);

  async function update(id: string, archive: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await workspaceApi.setArchived(id, archive);
      const selected = selectedWorkspaceId();
      const next = !archive ? id : result.workspaces.find((item) => item.id === selected)?.id ?? result.workspaces[0]?.id;
      window.location.assign(`/settings?tab=workspaces${next ? `&workspace=${encodeURIComponent(next)}` : ""}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update workspace.");
      setBusy(false);
    }
  }

  return <WorkspaceArchiveView archived={archived} error={error} busy={busy} allowArchive={allowArchive}
    onArchive={() => { const id = selectedWorkspaceId(); if (id) void update(id, true); }}
    onRestore={(id) => void update(id, false)} onRefresh={() => setAttempt((value) => value + 1)} />;
}

export function WorkspaceArchiveView({ archived, error = "", busy = false, allowArchive = true, onArchive, onRestore, onRefresh }: {
  archived: Workspace[];
  error?: string;
  busy?: boolean;
  allowArchive?: boolean;
  onArchive: () => void;
  onRestore: (id: string) => void;
  onRefresh: () => void;
}) {
  return <section className="space-y-4" aria-labelledby="archive-heading">
    <div>
      <h2 id="archive-heading" className="text-lg font-semibold">Archive and restore</h2>
      <p className="text-sm text-muted-foreground">Archiving hides an idle workspace from the selector. Tasks, history, configuration, and files are preserved. Finish queued jobs first.</p>
    </div>
    {allowArchive && <Button variant="outline" disabled={busy} onClick={onArchive}>Archive this workspace</Button>}
    <ul className="space-y-3">
      {archived.map((workspace) => <li key={workspace.id} className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-sm"><p className="font-medium">{workspace.name}</p><p className="break-all text-muted-foreground">{workspace.path}</p></div>
        <Button variant="outline" disabled={busy} onClick={() => onRestore(workspace.id)}>Restore <span className="sr-only">{workspace.name}</span></Button>
      </li>)}
    </ul>
    {!archived.length && !error && <p className="text-sm text-muted-foreground">No archived workspaces.</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" disabled={busy} onClick={onRefresh}>Refresh archived workspaces</Button></div>}
  </section>;
}
