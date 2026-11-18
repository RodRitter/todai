"use client";

import { useRef, useState, type ReactNode } from "react";
import { HoverCard } from "radix-ui";
import { FileText } from "lucide-react";
import { artifactCategory, type Artifact, type ArtifactReference } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { toast } from "@/components/ui/toast";
import { ArtifactViewer } from "./artifact-viewer";

export function ArtifactMention({ reference, children }: { reference: ArtifactReference; children: ReactNode }) {
  return <Citation key={`${reference.artifactId}:${reference.revisionId}`} reference={reference}>{children}</Citation>;
}

function Citation({ reference, children }: { reference: ArtifactReference; children: ReactNode }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<Promise<Artifact> | null>(null);
  function load(): Promise<Artifact> {
    if (artifact) return Promise.resolve(artifact);
    if (pending.current) return pending.current;
    setError(false);
    pending.current = (async () => {
      const response = await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: reference.artifactId, revision: reference.revisionId })}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Artifact unavailable.");
      const result: Artifact = await response.json();
      setArtifact(result);
      return result;
    })().catch((error) => { setError(true); throw error; }).finally(() => { pending.current = null; });
    return pending.current;
  }
  async function open() {
    setBusy(true);
    try { await load(); setSelected(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not open artifact."); }
    finally { setBusy(false); }
  }
  return <>
    <HoverCard.Root openDelay={300} onOpenChange={(open) => { if (open) void load().catch(() => {}); }}>
      <HoverCard.Trigger asChild>
        <button type="button" disabled={busy} onFocus={() => void load().catch(() => {})}
          title="Open cited artifact revision"
          className="inline cursor-pointer rounded-md border border-primary/15 bg-primary/5 px-1.5 py-0.5 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          onClick={() => void open()}><FileText aria-hidden="true" className="mr-1 inline size-3.5 align-text-bottom" />{children}</button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content sideOffset={6} className="z-50 w-72 max-w-[calc(100vw-2rem)] space-y-1 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
          {artifact ? <>
            <p className="break-words font-medium">{artifact.title}</p>
            <p className="text-xs text-muted-foreground"><span className="capitalize">{artifactCategory(artifact)}</span> · Revision {artifact.revisionNumber}{artifact.archived ? " · Archived" : ""}</p>
            {artifact.description && <p className="line-clamp-3 break-words text-xs text-muted-foreground">{artifact.description}</p>}
            <p className="pt-1 text-xs text-muted-foreground">Click to open this revision</p>
          </> : <p className="text-xs text-muted-foreground">{error ? "Preview unavailable. Click the citation to retry." : "Loading citation…"}</p>}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
    {selected && artifact && <ArtifactViewer key={artifact.revisionId} artifact={artifact} onClose={() => setSelected(false)} />}
  </>;
}
