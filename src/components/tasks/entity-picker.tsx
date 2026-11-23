"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { Bot, FileText, Files, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { artifactMentionPath } from "@/domain/artifact-mentions";
import { agentMentionPath } from "@/domain/agent-mentions";
import type { Artifact } from "@/domain/artifact";
import type { AgentProfile } from "@/domain/column-agent";
import type { TaskReference } from "@/domain/reference";
import { workspaceFetch } from "@/lib/workspace-fetch";
import type { Match } from "./description-references";
import { ReferencePopover } from "./reference-popover";

type Kind = "agent" | "artifact" | "skill" | "file";
type Filter = Kind | "all";
export type EntityReference = Omit<TaskReference, "kind"> & { kind: Kind; artifact?: Artifact };
const groups = [
  { kind: "agent", label: "Agents", icon: Bot },
  { kind: "artifact", label: "Artifacts", icon: Files },
  { kind: "skill", label: "Skills", icon: Sparkles },
  { kind: "file", label: "Files", icon: FileText },
] as const;
const labels: Record<Filter, string> = { all: "Available tags", agent: "Available agents", artifact: "Workspace artifacts", skill: "Available skills", file: "Workspace files" };

export function EntityPicker({ editor, id, match, agents, artifacts, keyboardRef, onDismiss, onSelect, onCreate }: {
  editor: Editor;
  id: string;
  match: Match;
  agents?: AgentProfile[];
  artifacts: boolean;
  keyboardRef: RefObject<(event: KeyboardEvent) => boolean>;
  onDismiss: () => void;
  onSelect: (reference: EntityReference) => void;
  onCreate: (query: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>(match.kind);
  const [query, setQuery] = useState(match.query);
  const [previousQuery, setPreviousQuery] = useState(match.query);
  const [selected, setSelected] = useState(0);
  if (previousQuery !== match.query) {
    setPreviousQuery(match.query);
    setQuery(match.query);
    setSelected(0);
  }
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([filter, query, attempt]);
  const [response, setResponse] = useState<{ key: string; items: EntityReference[]; failed: string[] }>({ key: "", items: [], failed: [] });
  const available = groups.filter(({ kind }) => kind === "agent" ? agents !== undefined : kind !== "artifact" || artifacts);
  const remoteKinds = available.filter(({ kind }) => kind !== "agent" && (filter === "all" || filter === kind)).map(({ kind }) => kind);
  const loading = remoteKinds.length > 0 && response.key !== key;
  const local: EntityReference[] = (filter === "all" || filter === "agent") ? (agents ?? [])
    .filter((agent) => agent.name.toLowerCase().includes(query.toLowerCase()))
    .map((agent) => ({ kind: "agent", label: `@${agent.name}`, path: agentMentionPath(agent.id), detail: agent.instructions })) : [];
  const items = [...local, ...(response.key === key ? response.items : [])];
  const visibleGroups = available.filter(({ kind }) => filter === "all" || kind === filter).map((group) => ({
    ...group, items: items.filter((item) => item.kind === group.kind).slice(0, filter === "all" ? 4 : 30),
    total: items.filter((item) => item.kind === group.kind).length,
  }));
  const results = visibleGroups.flatMap((group) => group.items);
  const canCreate = filter === "artifact" && !loading && !response.failed.includes("Artifacts");
  const count = results.length + (canCreate ? 1 : 0);
  const activeIndex = selected < count ? selected : 0;

  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      const kinds = groups.filter(({ kind }) => kind !== "agent" && (kind !== "artifact" || artifacts) && (filter === "all" || filter === kind));
      const responses = await Promise.allSettled(kinds.map(async ({ kind }) => {
        const response = await workspaceFetch(kind === "artifact" ? `/api/artifacts?search=${encodeURIComponent(query)}` : `/api/references?kind=${kind}&q=${encodeURIComponent(query)}`, { signal: abort.signal });
        if (!response.ok) throw new Error("References unavailable");
        if (kind === "artifact") {
          const artifacts: Artifact[] = await response.json();
          return artifacts.map((artifact): EntityReference => ({ kind, label: artifact.title, path: artifactMentionPath({ artifactId: artifact.id, revisionId: artifact.revisionId }), detail: `Revision ${artifact.revisionNumber} · ${artifact.type}`, artifact }));
        }
        const payload: { references: TaskReference[] } = await response.json();
        return payload.references;
      }));
      if (abort.signal.aborted) return;
      setResponse({ key, items: responses.flatMap<EntityReference>((result) => result.status === "fulfilled" ? result.value : []), failed: responses.flatMap((result, index) => result.status === "rejected" ? [kinds[index].label] : []) });
    }, 150);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [key, filter, query, artifacts]);

  function changeFilter(next: Filter) { setFilter(next); setSelected(0); }
  function handleKey(event: KeyboardEvent) {
    if (event.isComposing) return false;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); editor.commands.focus(); onDismiss(); return true;
    }
    if (count && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault(); setSelected((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + count) % count); return true;
    }
    if (count && (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey))) {
      event.preventDefault();
      if (activeIndex === results.length) onCreate(query);
      else onSelect(results[activeIndex]);
      return true;
    }
    // A search with no results must not submit the message.
    if (event.key === "Enter") { event.preventDefault(); return true; }
    return false;
  }
  useEffect(() => {
    keyboardRef.current = handleKey;
    return () => { keyboardRef.current = () => false; };
  });

  return <ReferencePopover editor={editor} id={id} label={labels[filter]} activeIndex={activeIndex} onDismiss={onDismiss}
    header={<div className="shrink-0 space-y-2 pb-2">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input variant="search" aria-label="Search tags" placeholder="Search agents, artifacts, skills, files…" value={query}
          aria-controls={id} aria-autocomplete="list" aria-activedescendant={count ? `${id}-${activeIndex}` : undefined}
          onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={(event) => handleKey(event.nativeEvent)} />
      </div>
      <div role="group" aria-label="Tag types" className="flex flex-wrap gap-1">
        <Button type="button" size="xs" variant={filter === "all" ? "secondary" : "ghost-muted"} aria-pressed={filter === "all"} onMouseDown={(event) => event.preventDefault()} onClick={() => changeFilter("all")}>All</Button>
        {available.map(({ kind, label }) => <Button key={kind} type="button" size="xs" variant={filter === kind ? "secondary" : "ghost-muted"} aria-pressed={filter === kind} onMouseDown={(event) => event.preventDefault()} onClick={() => changeFilter(kind)}>{label}</Button>)}
      </div>
    </div>}>
    {visibleGroups.map(({ kind, label, icon: Icon, items, total }) => items.length > 0 && <div key={kind} role="group" aria-label={label}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {filter === "all" && total > items.length && <Button type="button" variant="ghost-muted" size="xs" onMouseDown={(event) => event.preventDefault()} onClick={() => changeFilter(kind)}>Show all {label.toLowerCase()}</Button>}
      </div>
      {items.map((reference) => {
        const index = results.indexOf(reference);
        return <Button key={reference.path} type="button" size="row" variant={index === activeIndex ? "secondary" : "ghost"} role="option" aria-selected={index === activeIndex} id={`${id}-${index}`}
          onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(reference)}>
          <Icon aria-hidden="true" />
          <span className="min-w-0"><span className="block truncate">{reference.label}</span><span className="block truncate text-xs font-normal text-muted-foreground">{reference.detail}</span></span>
        </Button>;
      })}
    </div>)}
    {loading && <p role="status" className="p-2 text-xs text-muted-foreground">Loading references…</p>}
    {!loading && !results.length && <p role="status" className="p-2 text-xs text-muted-foreground">No matching references. Try another name or type.</p>}
    {response.key === key && response.failed.length > 0 && <div className="p-2 text-xs text-muted-foreground"><p role="status">Could not load: {response.failed.join(", ")}.</p><Button type="button" size="xs" variant="ghost" onMouseDown={(event) => event.preventDefault()} onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>}
    {canCreate && <Button type="button" size="row" variant={activeIndex === results.length ? "secondary" : "ghost"} id={`${id}-${results.length}`} role="option" aria-selected={activeIndex === results.length} onMouseDown={(event) => event.preventDefault()} onClick={() => onCreate(query)}>{query ? `Create artifact “${query}”` : "Create new artifact"}</Button>}
  </ReferencePopover>;
}
