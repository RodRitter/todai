"use client";

import { useRef, useState, type ReactNode } from "react";
import { HoverCard } from "radix-ui";
import { ReferenceChip } from "@/components/ui/reference-chip";
import { artifactCategory, type Artifact, type ArtifactReference } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { toast } from "@/components/ui/toast";
import { ArtifactViewer } from "./artifact-viewer";

export function ArtifactMention({ reference, children }: { reference: ArtifactReference; children: ReactNode }) {
  return <Citation key={reference.artifactId} reference={reference}>{children}</Citation>;
}

function Citation({ reference, children }: { reference: ArtifactReference; children: ReactNode }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<Promise<Artifact> | null>(null);
  function load(refresh = false): Promise<Artifact> {
    if (artifact && !refresh) return Promise.resolve(artifact);
    if (pending.current) return pending.current;
    setError(false);
    pending.current = (async () => {
      const response = await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: reference.artifactId })}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Artifact unavailable.");
      const result: Artifact = await response.json();
      setArtifact(result);
      return result;
    })().catch((error) => { setError(true); throw error; }).finally(() => { pending.current = null; });
    return pending.current;
  }
  async function open() {
    setBusy(true);
    try { await load(true); setSelected(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not open artifact."); }
    finally { setBusy(false); }
  }
  return <>
    <HoverCard.Root openDelay={300} onOpenChange={(open) => { if (open) void load().catch(() => {}); }}>
      <HoverCard.Trigger asChild>
        <ReferenceChip kind="artifact" type="button" disabled={busy} onFocus={() => void load().catch(() => {})}
          title="Open cited artifact"
          onClick={() => void open()}>{children}</ReferenceChip>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content sideOffset={6} className="z-50 w-72 max-w-[calc(100vw-2rem)] space-y-1 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
          {artifact ? <>
            <p className="break-words font-medium">{artifact.title}</p>
            <p className="text-xs text-muted-foreground"><span className="capitalize">{artifactCategory(artifact)}</span>{artifact.archived ? " · Archived" : ""}</p>
            {artifact.description && <p className="line-clamp-3 break-words text-xs text-muted-foreground">{artifact.description}</p>}
            <p className="pt-1 text-xs text-muted-foreground">Click to open this document</p>
          </> : <p className="text-xs text-muted-foreground">{error ? "Preview unavailable. Click the citation to retry." : "Loading citation…"}</p>}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
    {selected && artifact && <ArtifactViewer key={artifact.id} artifact={artifact} onClose={() => setSelected(false)} />}
  </>;
}
