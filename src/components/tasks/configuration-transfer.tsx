"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useId, useRef, useState, type ReactNode } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { notifyOperation, toast } from "@/components/ui/toast";
import { SettingField } from "@/components/ui/setting-field";
import { NativeSelect } from "@/components/ui/native-select";
import { exportFilename } from "@/lib/export-filename";
import { selectedBoardId, selectedWorkspaceId } from "@/lib/workspace-fetch";
import type { Board } from "@/domain/task";
import { boardApi, configurationApi, workspaceApi } from "@/lib/workspace-api";
import { parseConfiguration, selectConfiguration, type Configuration } from "@/domain/configuration";

function downloadConfiguration(data: Configuration, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Mode = "agents" | "columns" | "both";

export function ConfigurationTransfer({ onImported, scope = "all", boardId, disabled = false, importTrigger }: { onImported: () => void; scope?: "all" | "board" | "workspace" | "import"; boardId?: string; disabled?: boolean; importTrigger?: (open: () => void, busy: boolean) => ReactNode }) {
  const [importOpen, setImportOpen] = useState(false);
  const id = useId();
  const [boards, setBoards] = useState<Board[]>([]);
  const [exportBoardId, setExportBoardId] = useState("");
  const [existing, setExisting] = useState<Configuration | null>(null);
  const [conflictMode, setConflictMode] = useState<"copy" | "overwrite" | null>(null);
  const [source, setSource] = useState<Configuration | null>(null);
  const [operation, setOperation] = useState<"export" | "import">("export");
  const [mode, setMode] = useState<Mode>("both");
  const [agents, setAgents] = useState<string[]>([]);
  const [memory, setMemory] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMode, setColumnMode] = useState<"add" | "replace" | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  function prepare(data: Configuration, operation: "export" | "import") {
    setConflictMode(null);
    setColumnMode(null);
    setSource(data);
    setOperation(operation);
    setMode("both");
    setMemory(data.memory?.entries.map((entry) => entry.id) ?? []);
    setAgents(data.agents.map((agent) => agent.id));
    setColumns(data.columns.map((column) => column.id));
  }

  async function run(action: () => Promise<void>, transfer = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (transfer) await notifyOperation(action, { loading: "Transferring configuration…", success: "Configuration transferred.", error: (error) => error instanceof Error ? error.message : "Could not transfer configuration." });
      else await action();
    }
    catch (error) { if (!transfer) toast.error(error instanceof Error ? error.message : "Could not load configuration."); }
    finally { pending.current = false; setBusy(false); }
  }

  async function selectExportBoard(boardId: string) {
    const data = await configurationApi.get(boardId);
    prepare(data, "export");
    setExportBoardId(boardId);
  }

  const selected = source && selectConfiguration(source,
    operation === "export" || mode !== "columns" ? agents : [],
    operation === "export" ? source.columns.map((column) => column.id) : mode === "agents" ? [] : columns,
    memory);

  const conflicts = operation === "import" && selected && existing ? [
    ...selected.agents.filter((agent) => existing.agents.some((item) => item.id === agent.id)).map((agent) => `Agent: ${agent.name} (${agent.id})`),
    ...selected.columns.filter((column) => existing.columns.some((item) => item.id === column.id)).map((column) => `Column: ${column.name} (${column.id})`),
  ] : [];

  const selection = source && selected && !source.boards && (
        <fieldset disabled={busy} className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{operation === "export" ? "Export selection" : "Import selection"}</legend>
          {operation === "export" && <SettingField htmlFor={`${id}-board`} label="Board to export"><NativeSelect id={`${id}-board`} value={exportBoardId} onChange={(event) => { void run(() => selectExportBoard(event.target.value)); }}>
              {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
            </NativeSelect>

          </SettingField>}
          {operation === "import" && <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Configuration contents">
            {([['agents', 'Agents'], ['columns', 'Columns'], ['both', 'Agents and columns']] as const).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="transfer-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />{label}
              </label>
            ))}
          </div>}
          <div className="flex flex-col gap-6">
            {(operation === "export" || mode !== "columns") && <Selection title="Agents" items={source.agents.map((agent) => ({ id: agent.id, label: agent.name }))} selected={agents} onChange={setAgents} />}
            {operation === "import" && mode !== "agents" && <Selection title="Columns" items={source.columns.map((column) => ({ id: column.id, label: column.name, detail: column.id }))} selected={columns} onChange={setColumns} />}
          </div>
          {source.memory && <Selection title="Memory" items={source.memory.entries.map((entry) => ({ id: entry.id, label: entry.title }))} selected={memory} onChange={setMemory} />}

          {operation === "import" && selected.columns.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">How should columns be imported?</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="column-import-mode" checked={columnMode === "add"} onChange={() => setColumnMode("add")} />Add imported columns</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="column-import-mode" checked={columnMode === "replace"} onChange={() => setColumnMode("replace")} />Replace all existing columns</label>

            </fieldset>
          )}

          {conflicts.length > 0 && <fieldset className="space-y-2 rounded border p-3">
            <legend className="text-sm font-medium">Matching IDs found — overwrite existing entries?</legend>
            <ScrollArea className="max-h-40"><ul className="text-xs text-muted-foreground">{conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul></ScrollArea>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="conflicts" checked={conflictMode === "copy"} onChange={() => setConflictMode("copy")} />Keep existing entries and import new copies</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="conflicts" checked={conflictMode === "overwrite"} onChange={() => setConflictMode("overwrite")} />Overwrite entries with matching IDs</label>

          </fieldset>}
          <p className="text-sm" role="status">{selected.agents.length} agents, {selected.columns.length} columns, {selected.assignments.length} assignments, {selected.memory?.entries.length ?? 0} memory entries selected.</p>
          <div className="flex gap-2">
            <Button disabled={busy || (conflicts.length > 0 && conflictMode === null) || (!selected.agents.length && !selected.columns.length && !selected.memory?.entries.length) || (operation === "import" && selected.columns.length > 0 && columnMode === null)} onClick={() => run(async () => {
              if (operation === "import") {
                await configurationApi.import(selected, columnMode ?? "add", conflicts.length ? conflictMode ?? "copy" : "copy", boardId);
                setSource(null);
                window.dispatchEvent(new Event("todai:boards-changed"));
                setImportOpen(false);
                onImported();
              } else {
                downloadConfiguration(selected, exportFilename("board", boards.find((board) => board.id === exportBoardId)!.name));
                setSource(null);
              }
            }, true)}>{busy ? "Working…" : operation === "export" ? "Export selected" : "Import selected"}</Button>
            <Button variant="ghost" onClick={() => setSource(null)}>Cancel</Button>
          </div>
        </fieldset>
      );

  const importControls = <>
        <SettingField htmlFor="configuration-file" label="Import configuration file">
          <Input id="configuration-file" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setSource(null);
            void run(async () => {
              let data: unknown;
              try { data = JSON.parse(await file.text()); }
              catch { throw new Error("Choose a valid JSON file."); }
              const parsed = parseConfiguration(data);
              setExisting(parsed.boards ? null : await configurationApi.get(boardId));
              prepare(parsed, "import");
            });
          }} />
        </SettingField>
      {operation === "import" && source?.boards && <fieldset disabled={busy} className="space-y-4">
        <legend className="text-sm font-semibold">Import workspace</legend>

        <ScrollArea className="max-h-60"><ul className="space-y-2">{source.boards.map((board) => <li key={board.id}>{board.name} · {board.columns.length} {board.columns.length === 1 ? "column" : "columns"}</li>)}</ul></ScrollArea>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => run(async () => {
            await configurationApi.import(source);
            setSource(null);
            window.dispatchEvent(new Event("todai:boards-changed"));
            setImportOpen(false);
            onImported();
          }, true)}>{busy ? "Importing workspace…" : "Import workspace"}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setSource(null)}>Cancel</Button>
        </div>
      </fieldset>}
      {operation === "import" && selection}
  </>;

  return (
    <Dialog open={source !== null && operation === "export"} onOpenChange={(open) => { if (!open && !pending.current) setSource(null); }}>
    <section className={scope === "workspace" ? "space-y-1" : "space-y-4"} aria-label="Import and export">
      {scope !== "import" && <div className="space-y-4">
        {(scope === "all" || scope === "board") && <DialogTrigger asChild><Button variant="outline" disabled={busy || disabled} onClick={() => run(async () => {
          const available = await boardApi.list();
          if (!available.length) throw new Error("No boards are available to export.");
          setBoards(available);
          await selectExportBoard(available.find((board) => board.id === (boardId ?? selectedBoardId()))?.id ?? available[0].id);
        })}><Download className="size-4" aria-hidden="true" />Export board</Button></DialogTrigger>}
        {(scope === "all" || scope === "workspace") && <Button variant={scope === "workspace" ? "sidebar" : "outline"} size={scope === "workspace" ? "sidebar" : "default"} disabled={busy || disabled} onClick={() => run(async () => {
          const [data, workspaces] = await Promise.all([configurationApi.exportWorkspace(), workspaceApi.list()]);
          const workspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId());
          if (!workspace) throw new Error("Could not find the workspace title. Reload the page and try again.");
          downloadConfiguration(data, exportFilename("workspace", workspace.name));
        }, true)}><Download aria-hidden="true" />Export workspace</Button>}

      </div>}
      {scope !== "board" && (scope !== "all" ? <Dialog open={importOpen} onOpenChange={open => { if (!pending.current) setImportOpen(open); }}>
        {importTrigger ? importTrigger(() => { setSource(null); setImportOpen(true); }, busy || disabled) : <DialogTrigger asChild><Button variant={scope === "workspace" ? "sidebar" : "outline"} size={scope === "workspace" ? "sidebar" : "default"} disabled={busy || disabled} onClick={() => { setSource(null); setImportOpen(true); }}><Upload aria-hidden="true" />Import configuration</Button></DialogTrigger>}
        <DialogContent size="wide" aria-describedby={undefined} closeDisabled={busy}>
          <DialogHeader><DialogTitle>Import configuration</DialogTitle></DialogHeader>
          {importControls}
        </DialogContent>
      </Dialog> : importControls)}
      <DialogContent aria-describedby={undefined} size="wide" closeDisabled={busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Export board configuration</DialogTitle>
        </DialogHeader>
        {operation === "export" && selection}
      </DialogContent>
    </section>
    </Dialog>
  );
}

function Selection({ title, items, selected, onChange }: {
  title: string;
  items: { id: string; label: string; detail?: string }[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{selected.length} of {items.length} selected</span>
        <div className="flex gap-1">
          <Button size="xs" variant="ghost"  aria-label={`Select all ${title.toLowerCase()}`} onClick={() => onChange(items.map((item) => item.id))}>Select all</Button>
          <Button size="xs" variant="ghost"  aria-label={`Clear ${title.toLowerCase()}`} onClick={() => onChange([])}>Clear</Button>
        </div>
      </div>
      <ScrollArea className="max-h-60"><div className="divide-y rounded-md border">
        {items.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No {title.toLowerCase()} available.</p>}
        {items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:bg-muted/30">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-primary"
              checked={selected.includes(item.id)}
              onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="break-words font-medium">{item.label}</span>
              {item.detail && <span className="break-all font-mono text-xs text-muted-foreground">{item.detail}</span>}
            </span>
          </label>
        ))}
      </div></ScrollArea>
    </fieldset>
  );
}
