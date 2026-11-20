"use client";

import { DropdownMenu } from "radix-ui";
import { ChevronDown, FileText, ImageIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ArtifactTable } from "./artifact-table";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DescriptionEditor } from "@/components/tasks/description-editor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { artifactCategory, MAX_ARTIFACT_BYTES, type Artifact, type ArtifactType } from "@/domain/artifact";
import type { Task } from "@/domain/task";
import { workspaceFetch } from "@/lib/workspace-fetch";

const typeLabels = { document: "Document", image: "Image", file: "File", link: "External link" };
const imageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp"];

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

  function create(kind: "document" | "image") {
    setEditing(null); setContent(""); setType(kind === "document" ? "markdown" : "file"); setCreating(true);
  }

  const imageUpload = type === "file" && (!editing || artifactCategory(editing) === "image");

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
    if (imageUpload && (!(file instanceof File) || !imageTypes.includes(file.type))) {
      toast.error("Choose a PNG, JPEG, GIF, WebP, AVIF, or BMP image.");
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
      setEditing(artifact); setType(artifact.type === "text" ? "markdown" : artifact.type); setContent(text); setCreating(true);
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

  const visible = artifacts.filter((artifact) => (!filterType || artifactCategory(artifact) === filterType)
    && (!creator || artifact.creator === creator)
    && `${artifact.title} ${artifact.description} ${artifact.filename ?? ""} ${artifact.url ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <AppShell screen="artifacts"><main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Workspace artifacts</h2><p className="text-sm text-muted-foreground">Documents, files, and references shared across this workspace.</p></div>
      <div className="flex shrink-0 items-center" role="group" aria-label="Create artifact">
        <Button segment="start" onClick={() => create("document")} disabled={saving || creating}>Create artifact</Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><Button size="icon" segment="end" disabled={saving || creating} aria-label="Choose artifact type"><ChevronDown aria-hidden="true" /></Button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground" onSelect={() => create("document")}><FileText className="size-4" aria-hidden="true" />Document</DropdownMenu.Item>
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground" onSelect={() => create("image")}><ImageIcon className="size-4" aria-hidden="true" />Image</DropdownMenu.Item>
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
    {creating && <Dialog open onOpenChange={(open) => { if (!saving) setCreating(open); }}><DialogContent size="large" closeDisabled={saving}>
      <DialogHeader><DialogTitle>{editing ? "Publish new revision" : imageUpload ? "Create image" : "Create document"}</DialogTitle><DialogDescription className="sr-only">{imageUpload ? "Upload an image to your workspace." : "Write and publish a workspace document."}</DialogDescription></DialogHeader>
      <form key={editing?.revisionId ?? type} onSubmit={publish} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-wrap gap-4">
        <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="artifact-title">Title</Label><Input id="artifact-title" name="title" defaultValue={editing?.title ?? ""} required maxLength={300} disabled={saving} /></div>
        <div className="space-y-2"><Label htmlFor="artifact-creator">Creator name</Label><Input id="artifact-creator" name="creator" required maxLength={200} defaultValue="You" disabled={saving} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="artifact-description">Description</Label><Textarea id="artifact-description" name="description" defaultValue={editing?.description ?? ""} maxLength={10000} disabled={saving} /></div>
      {type === "file" ? <div className="space-y-2"><Label htmlFor="artifact-file">{imageUpload ? "Image" : "File"}</Label><Input id="artifact-file" type="file" name="file" accept={imageUpload ? imageTypes.join(",") : undefined} required disabled={saving} /><p className="text-sm text-muted-foreground">{imageUpload ? "PNG, JPEG, GIF, WebP, AVIF, or BMP, up to 20 MiB." : "Any file type, up to 20 MiB."} A stored copy is kept independently of the original file.</p></div>
        : type === "link" ? <div className="space-y-2"><Label htmlFor="artifact-url">External URL</Label><Input id="artifact-url" name="url" defaultValue={editing?.url ?? ""} type="url" required maxLength={8000} placeholder="https://example.com" disabled={saving} /><p className="text-sm text-muted-foreground">Stores the URL and metadata only. Remote content can change; upload a copy to preserve it.</p></div>
          : <><input type="hidden" name="content" value={content} /><DescriptionEditor id="artifact-content" label="Document content" value={content} onChange={setContent} disabled={saving} /></>}
      <div className="flex items-center gap-2"><Button type="submit" disabled={saving}>{saving ? "Publishing…" : editing ? "Publish revision" : imageUpload ? "Publish image" : "Publish document"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setCreating(false)}>Cancel</Button></div>
    </form></DialogContent></Dialog>}
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2"><Label htmlFor="artifact-task">Linked task</Label>
        <Select value={taskId || "all"} onValueChange={(value) => { setTaskId(value === "all" ? "" : value); setLoading(true); setArtifacts([]); }}>
          <SelectTrigger id="artifact-task" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All tasks</SelectItem>{tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label htmlFor="artifact-view">View</Label>
        <Select value={archived ? "archived" : "active"} disabled={saving} onValueChange={(value) => { setArchived(value === "archived"); setLoading(true); setArtifacts([]); setHistory([]); setCreating(false); }}>
          <SelectTrigger id="artifact-view" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="active">Active artifacts</SelectItem><SelectItem value="archived">Archived artifacts</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="artifact-search">Search artifacts</Label><Input id="artifact-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artifacts…" /></div>
      <div className="space-y-2"><Label htmlFor="artifact-filter-type">Type</Label>
        <Select value={filterType || "all"} onValueChange={(value) => setFilterType(value === "all" ? "" : value)}>
          <SelectTrigger id="artifact-filter-type" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label htmlFor="artifact-filter-creator">Creator</Label>
        <Select value={creator ? `creator:${creator}` : "all"} onValueChange={(value) => setCreator(value === "all" ? "" : value.slice(8))}>
          <SelectTrigger id="artifact-filter-creator" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All creators</SelectItem>{Array.from(new Set(artifacts.map((artifact) => artifact.creator))).sort().map((name) => <SelectItem key={name} value={`creator:${name}`}>{name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {loading ? <p aria-busy="true">Loading artifacts…</p> : !error && !visible.length ? <p className="text-muted-foreground">{artifacts.length ? "No artifacts match these filters." : "No artifacts in this view."}</p> : null}
    {visible.length > 0 && <ArtifactTable artifacts={visible} busy={saving} onEdit={(artifact) => void edit(artifact)} onHistory={(artifact) => void showHistory(artifact)} onArchive={(artifact) => void archive(artifact)} />}
    {history.length > 0 && <section aria-label="Revision history" className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Revision history</h3><Button variant="outline" onClick={() => setHistory([])}>Close history</Button></div>
      <ArtifactTable artifacts={history} label="Artifact revisions" />
    </section>}
  </main></AppShell>;
}
