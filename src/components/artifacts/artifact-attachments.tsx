"use client";

import { useEffect, useState } from "react";
import type { Artifact, ArtifactReference, TaskArtifact } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover } from "radix-ui";
import { Eye, FileText, Link2, MessageSquare, Paperclip, Plus, Unlink } from "lucide-react";
import { ArtifactViewer } from "./artifact-viewer";
import { toast } from "@/components/ui/toast";

async function checked(response: Response) {
  if (!response.ok) throw new Error((await response.json()).error ?? "Could not load artifacts.");
  return response;
}

export function ArtifactOpenButton({ artifact, latest = false, compact = false }: { artifact: Artifact; latest?: boolean; compact?: boolean }) {
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      setSelected(latest
        ? await (await checked(await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: artifact.id })}`))).json()
        : artifact);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not open artifact."); }
    finally { setBusy(false); }
  }
  const label = latest ? `Open latest revision of ${artifact.title}` : `Open ${artifact.title}, revision ${artifact.revisionNumber}`;
  return <>
    <Button type="button" size={compact ? "icon" : "sm"} variant={compact ? "ghost" : "outline"} className={compact ? "size-7" : undefined} disabled={busy} aria-label={label} title={label} onClick={() => void open()}>
      {compact ? <Eye aria-hidden="true" /> : latest ? "Open latest revision" : `Open · r${artifact.revisionNumber}`}
    </Button>
    {selected && <ArtifactViewer key={selected.revisionId} artifact={selected} onClose={() => setSelected(null)} />}
  </>;
}

export function ArtifactPicker({ onSelect, disabled, label = "Attach artifact", compact = false, attachmentIcon = false }: {
  onSelect: (artifact: Artifact) => void; disabled?: boolean; label?: string; compact?: boolean; attachmentIcon?: boolean;
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
  const trigger = (
    <Button type="button" variant={compact || attachmentIcon ? "ghost" : "outline"} size={compact || attachmentIcon ? "icon" : "sm"} className={compact ? "size-7 text-muted-foreground" : undefined} disabled={disabled} aria-label={open ? "Close artifact picker" : label} title={open ? "Close artifact picker" : label} aria-expanded={open} onClick={() => open ? setOpen(false) : void load()}>{attachmentIcon ? <Paperclip aria-hidden="true" /> : compact ? <Plus aria-hidden="true" className={open ? "rotate-45 transition-transform" : "transition-transform"} /> : open ? "Close artifact picker" : label}</Button>
  );
  const panel = (
<div className={compact ? "col-span-2 space-y-2" : "space-y-2"}>
      <Input aria-label="Search workspace artifacts" placeholder="Search artifacts" value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled} />
      {loading ? <p role="status" className="text-sm">Loading artifacts…</p> : error ? <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => void load()}>Retry</Button></div> : <ul className="max-h-48 space-y-1 overflow-y-auto">
        {visible.map((artifact) => <li key={artifact.id}><Button type="button" variant="ghost" className="h-auto whitespace-normal text-left" disabled={disabled} onClick={() => { onSelect(artifact); setOpen(false); }}>{artifact.title} · r{artifact.revisionNumber} · {artifact.type}</Button></li>)}
        {!visible.length && <li className="text-sm text-muted-foreground">No matching artifacts.</li>}
      </ul>}
    </div>
  );
  if (attachmentIcon) return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>{trigger}</Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} align="start" className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3 text-popover-foreground shadow-md">{panel}</Popover.Content></Popover.Portal>
  </Popover.Root>;
  return <div className={compact ? "contents" : "space-y-2"}>{trigger}{open && panel}</div>;
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

export function TaskArtifacts({ taskId, commentsKey, onNavigateComment, onCountChange }: { taskId: string; commentsKey: string; onNavigateComment?: (commentId: string) => void; onCountChange?: (count: number) => void }) {
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
      if (!controller.signal.aborted) { setLinks(items); onCountChange?.(items.length); setError(""); setLoading(false); }
    }
    const refresh = () => { void checkedFetch().catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); }); };
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [taskId, commentsKey, attempt, onCountChange]);
  async function change(artifactId: string, remove = false) {
    setBusy(true);
    try {
      const response = await checked(await workspaceFetch("/api/artifacts/links", { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, artifactId }) }));
      const items: TaskArtifact[] = await response.json();
      setLinks(items); onCountChange?.(items.length); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not change artifact link."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Task artifacts" className="space-y-3">
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <h3 className="text-sm font-semibold">Artifacts</h3>
      <ArtifactPicker compact label="Link artifact to task" disabled={busy} onSelect={(artifact) => void change(artifact.id)} />
    </div>
    {error && <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {loading && <p role="status">Loading task artifacts…</p>}
    {!loading && !error && !links.length && <p className="text-sm text-muted-foreground">No linked artifacts yet.</p>}
    <ul className="space-y-1">
      {links.map(({ artifact, explicit, comments }) => <li key={artifact.id} className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 focus-within:bg-muted/60">
        {artifact.type === "link" ? <Link2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate font-medium" title={artifact.title}>{artifact.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{artifact.archived ? "Archived" : explicit ? "Latest" : "Pinned"}</span>
        <div className="flex shrink-0 items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          {explicit && <ArtifactOpenButton artifact={artifact} latest compact />}
          {comments.length > 0 && <Popover.Root>
            <Popover.Trigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`View ${comments.length} comment ${comments.length === 1 ? "reference" : "references"} for ${artifact.title}`} title="Comment references"><MessageSquare aria-hidden="true" className="size-4" /></Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content sideOffset={6} align="end" className="z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
                <p className="text-xs font-semibold">Pinned comment references</p>
                {comments.map((citation, index) => <div key={`${citation.commentId}:${citation.artifact.revisionId}`} className="flex items-center gap-2 text-sm">
                  <Popover.Close asChild><a className="min-w-0 flex-1 truncate underline underline-offset-4" href={`#comment-${citation.commentId}`} onClick={() => onNavigateComment?.(citation.commentId)} title={citation.artifact.title}>Comment {index + 1} · {citation.artifact.title}</a></Popover.Close>
                  <span className="shrink-0 text-xs text-muted-foreground">r{citation.artifact.revisionNumber}</span>
                  <ArtifactOpenButton artifact={citation.artifact} compact />
                </div>)}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>}
          {explicit && <Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" disabled={busy} aria-label={`Unlink ${artifact.title} from task`} title="Unlink from task" onClick={() => void change(artifact.id, true)}><Unlink aria-hidden="true" /></Button>}
        </div>
      </li>)}
    </ul>
  </section>;
}
