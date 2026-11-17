"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { artifactTypes, MAX_ARTIFACT_BYTES, type Artifact, type ArtifactType } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";

const typeLabels = { text: "Text", markdown: "Markdown", file: "File", link: "External link" };

async function checked(response: Response) {
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "Could not access artifacts.");
  }
  return response;
}

export function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [creator, setCreator] = useState("");
  const [type, setType] = useState<ArtifactType>("markdown");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    workspaceFetch("/api/artifacts", { signal: controller.signal }).then(checked)
      .then((response) => response.json()).then((items: Artifact[]) => {
        setArtifacts(items);
        setError("");
        setLoading(false);
      }).catch((error: Error) => {
        if (!controller.signal.aborted) { setError(error.message); setLoading(false); }
      });
    return () => controller.abort();
  }, [attempt]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (file instanceof File && file.size > MAX_ARTIFACT_BYTES) {
      toast.error("Files must be 20 MiB or smaller.");
      return;
    }
    setSaving(true);
    try {
      const response = await checked(await workspaceFetch("/api/artifacts", { method: "POST", body: data }));
      const artifact: Artifact = await response.json();
      setArtifacts((items) => [artifact, ...items]);
      setSearch(""); setFilterType(""); setCreator("");
      setCreating(false);
      toast.success("Artifact published.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not publish artifact."); }
    finally { setSaving(false); }
  }

  async function download(artifact: Artifact) {
    try {
      const response = await checked(await workspaceFetch(`/api/artifacts/download?id=${encodeURIComponent(artifact.id)}`));
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = artifact.filename ?? "artifact";
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not download artifact."); }
  }

  const visible = artifacts.filter((artifact) => (!filterType || artifact.type === filterType)
    && (!creator || artifact.creator === creator)
    && `${artifact.title} ${artifact.description} ${artifact.filename ?? ""} ${artifact.url ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <AppShell screen="artifacts"><main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Workspace artifacts</h2><p className="text-sm text-muted-foreground">Documents, files, and references shared across this workspace.</p></div>
      <Button onClick={() => setCreating((value) => !value)} disabled={saving}>{creating ? "Cancel" : "Create artifact"}</Button>
    </div>
    {creating && <Card><CardHeader><CardTitle>Create artifact</CardTitle></CardHeader><form onSubmit={publish} className="space-y-4 px-5">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2"><Label htmlFor="artifact-type">Type</Label><NativeSelect id="artifact-type" name="type" value={type} onChange={(event) => setType(event.target.value as ArtifactType)} disabled={saving}>{artifactTypes.map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</NativeSelect></div>
        <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="artifact-title">Title</Label><Input id="artifact-title" name="title" required maxLength={300} disabled={saving} /></div>
        <div className="space-y-2"><Label htmlFor="artifact-creator">Creator name</Label><Input id="artifact-creator" name="creator" required maxLength={200} defaultValue="You" disabled={saving} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="artifact-description">Description</Label><Textarea id="artifact-description" name="description" maxLength={10000} disabled={saving} /></div>
      {type === "file" ? <div className="space-y-2"><Label htmlFor="artifact-file">File</Label><Input id="artifact-file" type="file" name="file" required disabled={saving} /><p className="text-sm text-muted-foreground">Any file type, up to 20 MiB. A stored copy is kept independently of the original file.</p></div>
        : type === "link" ? <div className="space-y-2"><Label htmlFor="artifact-url">External URL</Label><Input id="artifact-url" name="url" type="url" required maxLength={8000} placeholder="https://example.com" disabled={saving} /><p className="text-sm text-muted-foreground">Stores the URL and metadata only. Remote content can change; upload a copy to preserve it.</p></div>
          : <div className="space-y-2"><Label htmlFor="artifact-content">{typeLabels[type]} content</Label><Textarea id="artifact-content" name="content" rows={10} disabled={saving} /><p className="text-sm text-muted-foreground">Up to 20 MiB of UTF-8 text.</p></div>}
      <Button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish artifact"}</Button>
    </form></Card>}
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="artifact-search">Search artifacts</Label><Input id="artifact-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles, descriptions, filenames, or URLs" /></div>
      <div className="space-y-2"><Label htmlFor="artifact-filter-type">Type</Label><NativeSelect id="artifact-filter-type" value={filterType} onChange={(event) => setFilterType(event.target.value)}><option value="">All types</option>{artifactTypes.map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</NativeSelect></div>
      <div className="space-y-2"><Label htmlFor="artifact-filter-creator">Creator</Label><NativeSelect id="artifact-filter-creator" value={creator} onChange={(event) => setCreator(event.target.value)}><option value="">All creators</option>{Array.from(new Set(artifacts.map((artifact) => artifact.creator))).sort().map((name) => <option key={name}>{name}</option>)}</NativeSelect></div>
    </div>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {loading ? <p aria-busy="true">Loading artifacts…</p> : !error && !visible.length ? <p className="text-muted-foreground">{artifacts.length ? "No artifacts match these filters." : "No artifacts yet. Create a document, upload a file, or register a link."}</p> : null}
    <ul className="space-y-3">{visible.map((artifact) => <li key={artifact.id}><Card>
      <CardHeader><p className="text-xs font-medium text-muted-foreground">{typeLabels[artifact.type]}</p><CardTitle><h3>{artifact.title}</h3></CardTitle>
        {artifact.description && <CardDescription className="whitespace-pre-wrap">{artifact.description}</CardDescription>}
        <p className="break-words text-xs text-muted-foreground">By {artifact.creator} · Created {new Date(artifact.createdAt).toLocaleString()} · Updated {new Date(artifact.updatedAt).toLocaleString()}</p>
        {artifact.filename && <p className="break-words text-xs text-muted-foreground">{artifact.filename} · {artifact.mediaType} · {artifact.byteSize?.toLocaleString()} bytes</p>}
        {artifact.url && <p className="break-all text-sm text-muted-foreground">{artifact.url}</p>}
      </CardHeader><CardFooter>
      {artifact.url ? <Button variant="outline" asChild><a href={artifact.url} target="_blank" rel="noopener noreferrer">Open external link ↗</a></Button> : <Button variant="outline" onClick={() => download(artifact)}>Download</Button>}
    </CardFooter></Card></li>)}</ul>
  </main></AppShell>;
}
