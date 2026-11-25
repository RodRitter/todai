"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WorkspaceChatView } from "./workspace-chat-view";
import { notifyOperation, toast } from "@/components/ui/toast";
import { workspaceFetch } from "@/lib/workspace-fetch";
import type { WorkspaceChat, WorkspaceChatSummary, ChatModel } from "@/domain/workspace-chat";
import type { ExecutorStatus, ExecutorSettingsData } from "@/domain/column-agent";

async function request<T>(query = "", input?: unknown, method = "POST", signal?: AbortSignal): Promise<T> {
  const response = await workspaceFetch(`/api/workspace-chats${query}`, input ? { method, signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : { signal });
  if (response.status === 204) return undefined as T;
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "The chat request failed.");
  return value;
}
const failure = (error: unknown) => error instanceof Error ? error.message : "The operation failed.";
export function WorkspaceChatPage() {
  const [chats, setChats] = useState<WorkspaceChatSummary[]>([]), [session, setSession] = useState<WorkspaceChat | null>(null);
  const [selected, setSelected] = useState<string | null>(null), [statuses, setStatuses] = useState<ExecutorStatus[]>([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const selectedRef = useRef(selected), live = useRef(true), seen = useRef(new Set<string>()), submitting = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const select = useCallback((id: string | null) => {
    if (selectedRef.current === id) return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("chat", id); else url.searchParams.delete("chat");
    window.history.replaceState(null, "", url);
    selectedRef.current = id; setSelected(id); setSession(null); setLoading(!!id); setFailed(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([request<WorkspaceChatSummary[]>("", undefined, "GET", controller.signal), workspaceFetch("/api/executors?status=true", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Could not load model connections."); return response.json() as Promise<ExecutorSettingsData>;
    })]).then(([items, settings]) => {
      if (controller.signal.aborted) return;
      setChats(items); setStatuses(settings.statuses ?? []);
      const requested = new URL(window.location.href).searchParams.get("chat");
      select(items.find(item => item.id === requested)?.id ?? items[0]?.id ?? null);
    }).catch(error => { if (!controller.signal.aborted) { setFailed(true); toast.error(failure(error)); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, select]);
  const reportActivities = useCallback((value: WorkspaceChat, announce: boolean) => {
    for (const activity of value.activities) {
      if (!activity.mutation || activity.status === "running" || seen.current.has(activity.id)) continue;
      seen.current.add(activity.id);
      if (!announce) continue;
      void notifyOperation(() => { if (activity.status === "error") throw new Error(String(activity.result)); }, {
        loading: "Updating workspace…", success: `${activity.name.replaceAll("_", " ")}: complete.`, error: failure,
      }).catch(() => {});
      if (activity.status === "complete") window.dispatchEvent(new Event("todai:boards-changed"));
    }
  }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    let first = !submitting.current;
    async function refresh() {
      try {
        const value = await request<WorkspaceChat>(`?id=${encodeURIComponent(selected!)}`, undefined, "GET", controller.signal);
        if (controller.signal.aborted || selectedRef.current !== value.id) return;
        setSession(value); setFailed(false);
        reportActivities(value, !first);
        first = false;
        if (value.running || submitting.current) timer = setTimeout(refresh, 750);
      } catch (error) { if (!controller.signal.aborted) { setFailed(true); toast.error(failure(error)); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [selected, busy, attempt, reportActivities]);
  async function refreshList() {
    try { const items = await request<WorkspaceChatSummary[]>(); if (live.current) setChats(items); }
    catch (error) { if (live.current) { setFailed(true); toast.error(failure(error)); } }
  }
  async function create() {
    setBusy(true);
    try {
      const value = await notifyOperation(() => request<WorkspaceChat>("", { action: "create" }), { loading: "Creating chat…", success: "Chat created.", error: failure });
      if (live.current) { await refreshList(); select(value.id); }
    } catch {} finally { if (live.current) setBusy(false); }
  }
  async function send(body: string, model: ChatModel) {
    if (!selected || submitting.current) return;
    const id = selected; submitting.current = true; setBusy(true);
    try {
      const value = await request<WorkspaceChat>("", { action: "send", id, body, ...model });
      if (!live.current) return;
      if (selectedRef.current === id) setSession(value);
      reportActivities(value, true);
      if (value.error) toast.error(value.error);
      window.dispatchEvent(new Event("todai:boards-changed"));
      window.dispatchEvent(new Event("todai:usage-changed"));
      await refreshList();
    } catch (error) { if (live.current) toast.error(failure(error)); throw error; }
    finally { submitting.current = false; if (live.current) setBusy(false); }
  }
  return <AppShell screen="chat"><WorkspaceChatView chats={chats} session={session} statuses={statuses} busy={busy} loading={loading} failed={failed}
    onModelChange={async model => { if (!selected) return; const value = await notifyOperation(() => request<WorkspaceChat>("", { action: "model", id: selected, ...model }, "PATCH"), { loading: "Saving model settings…", success: "Model settings saved.", error: failure }); if (live.current && selectedRef.current === value.id) setSession(value); await refreshList(); }}
    onSelect={select} onCreate={() => void create()} onRetry={() => { setLoading(true); setFailed(false); setAttempt(value => value + 1); }} onSend={send}
    onRename={async (id, title) => { const value = await notifyOperation(() => request<WorkspaceChat>("", { id, title }, "PATCH"), { loading: "Renaming chat…", success: "Chat renamed.", error: failure }); setSession(value); await refreshList(); }}
    onDelete={async id => { await notifyOperation(() => request("", { id }, "DELETE"), { loading: "Deleting chat…", success: "Chat deleted.", error: failure }); await refreshList(); select(null); }}
  /></AppShell>;
}
