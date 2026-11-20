"use client";

import { workspaceFetch } from "@/lib/workspace-fetch";

import { useEffect, useState } from "react";
import { BookOpen, Lock, RefreshCw, Save, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkillTree } from "./skill-tree";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LocalSkill, SkillScope, SkillsSnapshot } from "@/domain/skill";

async function request<T>(scope: SkillScope, options?: RequestInit): Promise<T> {
  const response = await workspaceFetch(`/api/skills?scope=${scope}`, { cache: "no-store", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not access skills.");
  return result;
}

export function SkillsPage() {
  const [snapshots, setSnapshots] = useState<Record<SkillScope, SkillsSnapshot> | null>(null);
  const [scope, setScope] = useState<SkillScope>("todai");
  const [selected, setSelected] = useState<LocalSkill | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = selected !== null && draft !== selected.content;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([request<SkillsSnapshot>("workspace", { signal: controller.signal }), request<SkillsSnapshot>("todai", { signal: controller.signal }), request<SkillsSnapshot>("root", { signal: controller.signal })]).then(([workspace, todai, root]) => {
      if (controller.signal.aborted) return;
      setSnapshots({ workspace, todai, root });
      setScope(todai.skills.length ? "todai" : workspace.skills.length ? "workspace" : "root");
      const skill = todai.skills[0] ?? workspace.skills[0] ?? root.skills[0] ?? null;
      setSelected(skill);
      setDraft(skill?.content ?? "");
      setLoading(false);
    }).catch((error: Error) => {
      if (!controller.signal.aborted) { setError(error.message); setLoading(false); }
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function canDiscard() { return !dirty || window.confirm("Discard unsaved skill changes?"); }

  async function save() {
    if (!selected || saving || scope === "root") return;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await request<LocalSkill>(scope, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, content: draft, revision: selected.revision, directory: snapshots?.[scope].directory }) });
      setSelected(saved);
      setDraft(saved.content);
      setSnapshots((current) => current && ({ ...current, [scope]: { ...current[scope], skills: current[scope].skills.map((item) => item.id === saved.id ? saved : item) } }));
      setMessage(`Saved to ${scope === "todai" ? "Todai" : "Workspace"} SKILL.md.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save skill."); }
    finally { setSaving(false); }
  }

  return (
    <div onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest('a[href^="/"]') && (saving || !canDiscard())) event.preventDefault();
    }}>
      <AppShell screen="skills" headerActions={
        <Button size="sm" variant="ghost" disabled={loading || saving} onClick={() => {
          if (!canDiscard()) return;
          setLoading(true); setError(""); setMessage(""); setAttempt((value) => value + 1);
        }}><RefreshCw /> Refresh</Button>
      }>
        <main className="space-y-4 p-4 md:p-8" aria-label="Skills">

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p role="status" className={loading || message ? "text-sm text-muted-foreground" : "sr-only"}>{loading ? "Loading skills…" : message}</p>
          {!loading && snapshots && (
            <Card variant="flush" elevation="flat" className="grid min-h-[calc(100svh-8rem)] md:grid-cols-[16rem_minmax(0,1fr)]">
              <aside className="min-w-0 border-b bg-muted/20 md:border-r md:border-b-0" aria-label="Skill library">
                <div className="border-b p-3">
                  <div className="relative"><Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input variant="search" aria-label="Search skills" placeholder="Find a skill…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                </div>
                <div className="max-h-[calc(100svh-13rem)] space-y-1 overflow-y-auto p-2 py-3">
                  {([{ scope: "workspace", label: "Workspace", data: snapshots.workspace }, { scope: "todai", label: "Todai", data: snapshots.todai }, { scope: "root", label: "Root", data: snapshots.root }] as const).map((group) => (
                    <SkillTree key={group.scope} label={group.label} data={group.data} readOnly={group.scope === "root"} search={search} selectedId={scope === group.scope ? selected?.id : undefined} disabled={saving} onSelect={(skill) => {
                      if ((selected?.id === skill.id && scope === group.scope) || !canDiscard()) return;
                      setScope(group.scope); setSelected(skill); setDraft(skill.content); setError(""); setMessage("");
                    }} />
                  ))}
                </div>
              </aside>
              {selected ? <section className="min-w-0" aria-label={`Skill ${selected.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                  <div className="min-w-0"><h3 className="font-semibold">{selected.id}</h3><p className="mt-1 text-xs text-muted-foreground" title={selected.path}>{scope === "workspace" ? "Workspace" : scope === "todai" ? "Todai" : "Root"} / {selected.id} / SKILL.md</p></div>
                  <div className="flex items-center gap-2">
                    {scope === "root" && <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"><Lock className="size-3" />Read-only</span>}
                    {dirty && <><span className="text-xs text-muted-foreground">Unsaved</span><Button variant="ghost" size="sm" disabled={saving} onClick={() => { if (canDiscard()) { setDraft(selected.content); setError(""); } }}>Discard</Button></>}
                    {scope !== "root" && <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}><Save />{saving ? "Saving…" : "Save"}</Button>}
                  </div>
                </div>
                <Tabs defaultValue="preview" className="p-5">
                  <TabsList aria-label="Skill view"><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="source">{scope !== "root" ? "Edit source" : "View source"}</TabsTrigger></TabsList>
                  <TabsContent value="preview" className="mt-4 max-h-[65vh] overflow-y-auto"><Markdown>{draft.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")}</Markdown></TabsContent>
                  <TabsContent value="source" className="mt-4"><Textarea readOnly={scope === "root"} aria-label="Skill Markdown source" spellCheck={false} variant="code" className="min-h-[55vh]" value={draft} disabled={saving} onChange={(event) => { setDraft(event.target.value); setMessage(""); }} /><p className="mt-2 text-xs text-muted-foreground">{scope !== "root" ? "Edit the complete SKILL.md, including its YAML frontmatter." : "Root skill source is read-only."}</p></TabsContent>
                </Tabs>
              </section> : <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground"><BookOpen className="size-8" /><p className="text-sm">Select a skill to view its instructions.</p><p className="max-w-sm text-xs">Add a folder containing SKILL.md to Todai’s or your workspace’s .agents/skills directory to create a local skill.</p></div>}
            </Card>
          )}
        </main>
      </AppShell>
    </div>
  );
}
