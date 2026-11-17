"use client";

import { useEffect, useState } from "react";
import type { Artifact, ArtifactReference, TaskArtifact } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

async function checked(response: Response) {
  if (!response.ok) throw new Error((await response.json()).error ?? "Could not load artifacts.");
  return response;
}

export function ArtifactOpenButton({ artifact, latest = false }: { artifact: Artifact; latest?: boolean }) {
  async function download() {
    try {
      const selected: Artifact = latest
        ? await (await checked(await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: artifact.id })}`))).json()
        : artifact;
      if (selected.url) { window.location.assign(selected.url); return; }
      const response = await checked(await workspaceFetch(`/api/artifacts/download?${new URLSearchParams({ id: selected.id, revision: selected.revisionId })}`));
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = selected.filename ?? "artifact";
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not download artifact."); }
  }
  if (latest) return <Button type="button" size="sm" variant="outline" onClick={() => void download()}>Open latest revision</Button>;
  return artifact.url
    ? <Button type="button" size="sm" variant="outline" asChild><a href={artifact.url} target="_blank" rel="noopener noreferrer">Open external link · r{artifact.revisionNumber} ↗</a></Button>
    : <Button type="button" size="sm" variant="outline" onClick={() => void download()}>Download · r{artifact.revisionNumber}</Button>;
}

export function ArtifactPicker({ onSelect, disabled, label = "Attach artifact" }: {
  onSelect: (artifact: Artifact) => void; disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Artifact[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setOpen(true); setLoading(true); setError("");
    try { setItems(await (await checked(await workspaceFetch("/api/artifacts"))).json()); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not load artifacts."); }
    finally { setLoading(false); }
  }
  const visible = items.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-2">
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => open ? setOpen(false) : void load()}>{open ? "Close artifact picker" : label}</Button>
    {open && <div className="space-y-2">
      <Input aria-label="Search workspace artifacts" placeholder="Search artifacts" value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled} />
      {loading ? <p role="status" className="text-sm">Loading artifacts…</p> : error ? <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => void load()}>Retry</Button></div> : <ul className="max-h-48 space-y-1 overflow-y-auto">
        {visible.map((artifact) => <li key={artifact.id}><Button type="button" variant="ghost" className="h-auto whitespace-normal text-left" disabled={disabled} onClick={() => { onSelect(artifact); setOpen(false); }}>{artifact.title} · r{artifact.revisionNumber} · {artifact.type}</Button></li>)}
        {!visible.length && <li className="text-sm text-muted-foreground">No matching artifacts.</li>}
      </ul>}
    </div>}
  </div>;
}

export function CommentAttachments({ references }: { references: ArtifactReference[] }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(references);
  useEffect(() => {
    const controller = new AbortController();
    const refs: ArtifactReference[] = JSON.parse(key);
    Promise.all(refs.map(async (ref) => (await checked(await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: ref.artifactId, revision: ref.revisionId })}`, { signal: controller.signal }))).json()))
      .then((items: Artifact[]) => { setArtifacts(items); setError(""); })
      .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [key, attempt]);
  return <div aria-label="Comment attachments" className="space-y-2">
    {error && <div role="alert"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry attachments</Button></div>}
    {artifacts.map((artifact) => <div key={artifact.revisionId} className="flex flex-wrap items-center gap-2 text-sm"><span>{artifact.title}{artifact.archived ? " · Archived" : ""}</span><ArtifactOpenButton artifact={artifact} /></div>)}
  </div>;
}

export function TaskArtifacts({ taskId, commentsKey }: { taskId: string; commentsKey: string }) {
  const [links, setLinks] = useState<TaskArtifact[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    checkedFetch().catch((error: Error) => { if (!controller.signal.aborted) { setError(error.message); setLoading(false); } });
    async function checkedFetch() {
      const response = await checked(await workspaceFetch(`/api/artifacts/links?${new URLSearchParams({ taskId })}`, { signal: controller.signal }));
      const items: TaskArtifact[] = await response.json();
      if (!controller.signal.aborted) { setLinks(items); setError(""); setLoading(false); }
    }
    const refresh = () => { void checkedFetch().catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); }); };
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [taskId, commentsKey, attempt]);
  async function change(artifactId: string, remove = false) {
    setBusy(true);
    try {
      const response = await checked(await workspaceFetch("/api/artifacts/links", { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, artifactId }) }));
      setLinks(await response.json()); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not change artifact link."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Task artifacts" className="space-y-3">
    <h3 className="text-sm font-semibold">Artifacts</h3>
    <ArtifactPicker label="Link artifact to task" disabled={busy} onSelect={(artifact) => void change(artifact.id)} />
    {error && <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {loading && <p role="status">Loading task artifacts…</p>}
    {!loading && !error && !links.length && <p className="text-sm text-muted-foreground">No linked artifacts yet.</p>}
    {links.map(({ artifact, explicit, comments }) => <Card key={artifact.id}>
      <CardHeader><CardTitle>{artifact.title}{artifact.archived ? " · Archived" : ""}</CardTitle></CardHeader>
      <CardFooter className="flex-col items-start gap-3">
        {explicit && <div className="flex flex-wrap items-center gap-2 text-sm"><span>Task link · Latest revision</span><ArtifactOpenButton artifact={artifact} latest /><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void change(artifact.id, true)}>Unlink from task</Button></div>}
        {comments.map((citation) => <div key={`${citation.commentId}:${citation.artifact.revisionId}`} className="flex flex-wrap items-center gap-2 text-sm">
          <a className="underline" href={`#comment-${citation.commentId}`}>Comment attachment</a><span>{citation.artifact.title} · Pinned revision</span><ArtifactOpenButton artifact={citation.artifact} />
        </div>)}
      </CardFooter>
    </Card>)}
  </section>;
}
