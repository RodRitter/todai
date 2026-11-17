"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArtifactOpenButton } from "./artifact-attachments";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { artifactTypes, MAX_ARTIFACT_BYTES, type Artifact, type ArtifactType } from "@/domain/artifact";
import type { Task } from "@/domain/task";
import { workspaceFetch } from "@/lib/workspace-fetch";

const typeLabels = { text: "Text", markdown: "Markdown", file: "File", link: "External link" };

async function checked(response: Response) {
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "Could not access artifacts.");
  }
  return response;
}

async function fetchRevisionContent(artifact: Artifact) {
  return checked(await workspaceFetch(`/api/artifacts/download?id=${encodeURIComponent(artifact.id)}&revision=${encodeURIComponent(artifact.revisionId)}`));
}

export function ArtifactsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [creator, setCreator] = useState("");
  const [type, setType] = useState<ArtifactType>("markdown");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Artifact | null>(null);
  const [content, setContent] = useState("");
  const [history, setHistory] = useState<Artifact[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    workspaceFetch(`/api/artifacts?${new URLSearchParams({ archived: String(archived), taskId })}`, { signal: controller.signal }).then(checked)
      .then((response) => response.json()).then((items: Artifact[]) => {
        setArtifacts(items);
        setError("");
        setLoading(false);
      }).catch((error: Error) => {
        if (!controller.signal.aborted) { setError(error.message); setLoading(false); }
      });
    return () => controller.abort();
  }, [attempt, archived, taskId]);

  useEffect(() => {
    const controller = new AbortController();
    workspaceFetch("/api/tasks", { signal: controller.signal }).then(checked).then((response) => response.json()).then(setTasks)
      .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (editing) data.set("id", editing.id);
    const file = data.get("file");
    if (file instanceof File && file.size > MAX_ARTIFACT_BYTES) {
      toast.error("Files must be 20 MiB or smaller.");
      return;
    }
    setSaving(true);
    try {
      const response = await checked(await workspaceFetch("/api/artifacts", { method: "POST", body: data }));
      const artifact: Artifact = await response.json();
      setArtifacts((items) => [artifact, ...items.filter((item) => item.id !== artifact.id)]);
      setHistory([]);
      if (!artifact.archived) setArchived(false);
      setTaskId(""); setSearch(""); setFilterType(""); setCreator("");
      setCreating(false);
      toast.success("Artifact published.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not publish artifact."); }
    finally { setSaving(false); }
  }

  async function edit(artifact: Artifact) {
    setSaving(true);
    try {
      const text = artifact.type === "text" || artifact.type === "markdown"
        ? await (await fetchRevisionContent(artifact)).text()
        : "";
      setEditing(artifact); setType(artifact.type); setContent(text); setCreating(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load revision."); }
    finally { setSaving(false); }
  }

  async function showHistory(artifact: Artifact) {
    try {
      const response = await checked(await workspaceFetch(`/api/artifacts?id=${encodeURIComponent(artifact.id)}&history=true`));
      setHistory(await response.json());
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load history."); }
  }

  async function archive(artifact: Artifact) {
    setSaving(true);
    try {
      await checked(await workspaceFetch("/api/artifacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: artifact.id }) }));
      setArtifacts((items) => items.filter((item) => item.id !== artifact.id));
      if (editing?.id === artifact.id) setCreating(false);
      toast.success("Artifact archived. Its revisions remain available in the archived view.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not archive artifact."); }
    finally { setSaving(false); }
  }

  const visible = artifacts.filter((artifact) => (!filterType || artifact.type === filterType)
    && (!creator || artifact.creator === creator)
    && `${artifact.title} ${artifact.description} ${artifact.filename ?? ""} ${artifact.url ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <AppShell screen="artifacts"><main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Workspace artifacts</h2><p className="text-sm text-muted-foreground">Documents, files, and references shared across this workspace.</p></div>
      <Button onClick={() => { setEditing(null); setContent(""); setCreating((value) => !value); }} disabled={saving}>{creating ? "Cancel" : "Create artifact"}</Button>
    </div>
    {creating && <Card><CardHeader><CardTitle>{editing ? "Publish new revision" : "Create artifact"}</CardTitle></CardHeader><form key={editing?.revisionId ?? "new"} onSubmit={publish} className="space-y-4 px-5">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2"><Label htmlFor="artifact-type">Type</Label><NativeSelect id="artifact-type" name="type" value={type} onChange={(event) => setType(event.target.value as ArtifactType)} disabled={saving}>{artifactTypes.map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</NativeSelect></div>
        <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="artifact-title">Title</Label><Input id="artifact-title" name="title" defaultValue={editing?.title ?? ""} required maxLength={300} disabled={saving} /></div>
        <div className="space-y-2"><Label htmlFor="artifact-creator">Creator name</Label><Input id="artifact-creator" name="creator" required maxLength={200} defaultValue="You" disabled={saving} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="artifact-description">Description</Label><Textarea id="artifact-description" name="description" defaultValue={editing?.description ?? ""} maxLength={10000} disabled={saving} /></div>
      {type === "file" ? <div className="space-y-2"><Label htmlFor="artifact-file">File</Label><Input id="artifact-file" type="file" name="file" required disabled={saving} /><p className="text-sm text-muted-foreground">Any file type, up to 20 MiB. A stored copy is kept independently of the original file.</p></div>
        : type === "link" ? <div className="space-y-2"><Label htmlFor="artifact-url">External URL</Label><Input id="artifact-url" name="url" defaultValue={editing?.url ?? ""} type="url" required maxLength={8000} placeholder="https://example.com" disabled={saving} /><p className="text-sm text-muted-foreground">Stores the URL and metadata only. Remote content can change; upload a copy to preserve it.</p></div>
          : <div className="space-y-2"><Label htmlFor="artifact-content">{typeLabels[type]} content</Label><Textarea id="artifact-content" name="content" defaultValue={content} rows={10} disabled={saving} /><p className="text-sm text-muted-foreground">Up to 20 MiB of UTF-8 text.</p></div>}
      <Button type="submit" disabled={saving}>{saving ? "Publishing…" : editing ? "Publish revision" : "Publish artifact"}</Button>
    </form></Card>}
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2"><Label htmlFor="artifact-task">Linked task</Label><NativeSelect id="artifact-task" value={taskId} onChange={(event) => { setTaskId(event.target.value); setLoading(true); setArtifacts([]); }}><option value="">All tasks</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</NativeSelect></div>
      <div className="space-y-2"><Label htmlFor="artifact-view">View</Label><NativeSelect id="artifact-view" value={archived ? "archived" : "active"} disabled={saving} onChange={(event) => { setArchived(event.target.value === "archived"); setLoading(true); setArtifacts([]); setHistory([]); setCreating(false); }}><option value="active">Active artifacts</option><option value="archived">Archived artifacts</option></NativeSelect></div>
      <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="artifact-search">Search artifacts</Label><Input id="artifact-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles, descriptions, filenames, or URLs" /></div>
      <div className="space-y-2"><Label htmlFor="artifact-filter-type">Type</Label><NativeSelect id="artifact-filter-type" value={filterType} onChange={(event) => setFilterType(event.target.value)}><option value="">All types</option>{artifactTypes.map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</NativeSelect></div>
      <div className="space-y-2"><Label htmlFor="artifact-filter-creator">Creator</Label><NativeSelect id="artifact-filter-creator" value={creator} onChange={(event) => setCreator(event.target.value)}><option value="">All creators</option>{Array.from(new Set(artifacts.map((artifact) => artifact.creator))).sort().map((name) => <option key={name}>{name}</option>)}</NativeSelect></div>
    </div>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {loading ? <p aria-busy="true">Loading artifacts…</p> : !error && !visible.length ? <p className="text-muted-foreground">{artifacts.length ? "No artifacts match these filters." : "No artifacts in this view."}</p> : null}
    <ul className="space-y-3">{visible.map((artifact) => <li key={artifact.id}><Card>
      <CardHeader><p className="text-xs font-medium text-muted-foreground">{typeLabels[artifact.type]}</p><CardTitle><h3>{artifact.title}</h3></CardTitle>
        {artifact.description && <CardDescription className="whitespace-pre-wrap">{artifact.description}</CardDescription>}
        <p className="break-words text-xs text-muted-foreground">By {artifact.creator} · Created {new Date(artifact.createdAt).toLocaleString()} · Updated {new Date(artifact.updatedAt).toLocaleString()}</p>
        {artifact.filename && <p className="break-words text-xs text-muted-foreground">{artifact.filename} · {artifact.mediaType} · {artifact.byteSize?.toLocaleString()} bytes</p>}
        {artifact.url && <p className="break-all text-sm text-muted-foreground">{artifact.url}</p>}
      </CardHeader><CardFooter className="flex-wrap gap-2">
      <ArtifactOpenButton artifact={artifact} />
      <Button variant="outline" disabled={saving} onClick={() => edit(artifact)}>Publish revision</Button>
      <Button variant="outline" onClick={() => showHistory(artifact)}>Revision history</Button>
      {!artifact.archived && <Button variant="outline" disabled={saving} onClick={() => archive(artifact)}>Archive</Button>}
    </CardFooter></Card></li>)}</ul>
    {history.length > 0 && <section aria-label="Revision history" className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Revision history</h3><Button variant="outline" onClick={() => setHistory([])}>Close history</Button></div>
      {history.map((revision) => <Card key={revision.revisionId}><CardHeader>
        <CardTitle>{revision.title} · Revision {revision.revisionNumber}</CardTitle>
        <CardDescription className="whitespace-pre-wrap">{revision.description}</CardDescription>
        <p className="text-sm text-muted-foreground">{typeLabels[revision.type]} · By {revision.creator} · Published {new Date(revision.updatedAt).toLocaleString()}</p>
        {revision.filename && <p className="break-words text-sm text-muted-foreground">{revision.filename} · {revision.mediaType} · {revision.byteSize} bytes</p>}
        {revision.url && <p className="break-all text-sm text-muted-foreground">{revision.url} — URL and metadata only; remote content may change. Upload a copy to preserve it.</p>}
      </CardHeader><CardFooter><ArtifactOpenButton artifact={revision} /></CardFooter></Card>)}
    </section>}
  </main></AppShell>;
}
