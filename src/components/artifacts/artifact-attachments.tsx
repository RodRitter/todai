"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { artifactCategory, type Artifact, type ArtifactReference, type TaskArtifact } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover } from "radix-ui";
import { Eye, MessageSquare, Paperclip, Plus, Unlink } from "lucide-react";
import { ArtifactTable } from "./artifact-table";
import { ArtifactViewer } from "./artifact-viewer";
import { toast } from "@/components/ui/toast";

async function checked(response: Response) {
  if (!response.ok) throw new Error((await response.json()).error ?? "Could not load artifacts.");
  return response;
}

export function ArtifactOpenButton({ artifact, compact = false }: { artifact: Artifact; compact?: boolean }) {
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      setSelected(await (await checked(await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: artifact.id })}`))).json());
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not open artifact."); }
    finally { setBusy(false); }
  }
  const label = `Open ${artifact.title}`;
  return <>
    <Button type="button" size={compact ? "icon-xs" : "sm"} variant={compact ? "ghost" : "outline"} disabled={busy} aria-label={label} title={label} onClick={() => void open()}>
      {compact ? <Eye aria-hidden="true" /> : "Open"}
    </Button>
    {selected && <ArtifactViewer key={selected.id} artifact={selected} onClose={() => setSelected(null)} />}
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
    <Button type="button" variant={compact ? "ghost-muted" : attachmentIcon ? "ghost" : "outline"} size={compact ? "icon-xs" : attachmentIcon ? "icon" : "sm"} disabled={disabled} aria-label={open ? "Close artifact picker" : label} title={open ? "Close artifact picker" : label} aria-expanded={open} onClick={() => open ? setOpen(false) : void load()}>{attachmentIcon ? <Paperclip aria-hidden="true" /> : compact ? <Plus aria-hidden="true" className={open ? "rotate-45 transition-transform" : "transition-transform"} /> : open ? "Close artifact picker" : label}</Button>
  );
  const panel = (
<div className={compact ? "col-span-2 space-y-2" : "space-y-2"}>
      <Input aria-label="Search workspace artifacts" placeholder="Search artifacts" value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled} />
      {loading ? <p role="status" className="text-sm">Loading artifacts…</p> : error ? <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => void load()}>Retry</Button></div> : <ScrollArea className="max-h-48"><ul className="space-y-1 ">
        {visible.map((artifact) => <li key={artifact.id}><Button type="button" variant="ghost" size="row" disabled={disabled} onClick={() => { onSelect(artifact); setOpen(false); }}>{artifact.title} · {artifact.type}</Button></li>)}
        {!visible.length && <li className="text-sm text-muted-foreground">No matching artifacts.</li>}
      </ul></ScrollArea>}
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
    Promise.all(refs.map(async (ref) => (await checked(await workspaceFetch(`/api/artifacts?${new URLSearchParams({ id: ref.artifactId })}`, { signal: controller.signal }))).json()))
      .then((items: Artifact[]) => { setArtifacts(items); setError(""); })
      .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [key, attempt]);
  return <div aria-label="Comment attachments" className="space-y-2">
    {error && <div role="alert"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry attachments</Button></div>}
    {artifacts.map((artifact) => <div key={artifact.id} className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm"><Paperclip aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate font-medium" title={artifact.title}>{artifact.title}</p><p className="text-xs text-muted-foreground"><span className="capitalize">{artifactCategory(artifact)}</span>{artifact.archived ? " · Archived" : ""}</p></div><ArtifactOpenButton artifact={artifact} compact /></div>)}
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
  async function unlink(artifactId: string) {
    setBusy(true);
    try {
      const response = await checked(await workspaceFetch("/api/artifacts/links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, artifactId }) }));
      const items: TaskArtifact[] = await response.json();
      setLinks(items); onCountChange?.(items.length); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not change artifact link."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Task artifacts" className="space-y-3">
    <h3 className="text-sm font-semibold">Artifacts</h3>
    {error && <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {loading && <p role="status">Loading task artifacts…</p>}
    {!loading && !error && !links.length && <p className="text-sm text-muted-foreground">No artifacts yet. Link artifacts through comments, the task description, or chat.</p>}
    {links.length > 0 && <ArtifactTable artifacts={links.map(({ artifact }) => artifact)} label="Task artifacts" renderActions={(artifact) => {
      const { explicit, comments } = links.find((link) => link.artifact.id === artifact.id)!;
      return <>
          {comments.length > 0 && <Popover.Root>
            <Popover.Trigger asChild>
              <Button type="button" size="icon-xs" variant="ghost"  aria-label={`View ${comments.length} comment ${comments.length === 1 ? "reference" : "references"} for ${artifact.title}`} title="Comment references"><MessageSquare aria-hidden="true" className="size-4" /></Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content sideOffset={6} align="end" className="z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
                <p className="text-xs font-semibold">Comment references</p>
                {comments.map((citation, index) => <div key={`${citation.commentId}:${citation.artifact.id}`} className="flex items-center gap-2 text-sm">
                  <Popover.Close asChild><a className="min-w-0 flex-1 truncate underline underline-offset-4" href={`#comment-${citation.commentId}`} onClick={() => onNavigateComment?.(citation.commentId)} title={citation.artifact.title}>Comment {index + 1} · {citation.artifact.title}</a></Popover.Close>
                  <ArtifactOpenButton artifact={citation.artifact} compact />
                </div>)}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>}
          {explicit && <Button type="button" size="icon-xs" variant="ghost-destructive"  disabled={busy} aria-label={`Unlink ${artifact.title} from task`} title="Unlink from task" onClick={() => void unlink(artifact.id)}><Unlink aria-hidden="true" /></Button>}
      </>;
    }} />}
  </section>;
}
