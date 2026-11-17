"use client";

import { useState, type ReactNode } from "react";
import type { Artifact, ArtifactReference } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { toast } from "@/components/ui/toast";
import { ArtifactViewer } from "./artifact-viewer";

export function ArtifactMention({ reference, children }: { reference: ArtifactReference; children: ReactNode }) {
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const response = await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: reference.artifactId, revision: reference.revisionId })}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Artifact unavailable.");
      setSelected(await response.json());
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not open artifact."); }
    finally { setBusy(false); }
  }
  return <><button type="button" disabled={busy} title="Open cited artifact revision" className="cursor-pointer rounded bg-accent px-1 py-0.5 font-medium text-accent-foreground underline underline-offset-2 disabled:opacity-50" onClick={() => void open()}>{children}</button>{selected && <ArtifactViewer key={selected.revisionId} artifact={selected} onClose={() => setSelected(null)} />}</>;
}
