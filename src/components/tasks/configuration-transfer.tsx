"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { configurationApi } from "@/lib/workspace-api";
import { parseConfiguration, selectConfiguration, type Configuration } from "@/domain/configuration";

type Mode = "agents" | "columns" | "both";

export function ConfigurationTransfer({ onImported }: { onImported: () => void }) {
  const [existing, setExisting] = useState<Configuration | null>(null);
  const [conflictMode, setConflictMode] = useState<"copy" | "overwrite" | null>(null);
  const [source, setSource] = useState<Configuration | null>(null);
  const [operation, setOperation] = useState<"export" | "import">("export");
  const [mode, setMode] = useState<Mode>("both");
  const [agents, setAgents] = useState<string[]>([]);
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
    setAgents(data.agents.map((agent) => agent.id));
    setColumns(data.columns.map((column) => column.id));
  }

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { await action(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not transfer configuration."); }
    finally { pending.current = false; setBusy(false); }
  }

  const selected = source && selectConfiguration(source, mode === "columns" ? [] : agents, mode === "agents" ? [] : columns);

  const conflicts = operation === "import" && selected && existing ? [
    ...selected.agents.filter((agent) => existing.agents.some((item) => item.id === agent.id)).map((agent) => `Agent: ${agent.name} (${agent.id})`),
    ...selected.columns.filter((column) => existing.columns.some((item) => item.id === column.id)).map((column) => `Column: ${column.name} (${column.id})`),
  ] : [];

  const selection = source && selected && (
        <fieldset disabled={busy} className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{operation === "export" ? "Export selection" : "Import selection"}</legend>
          <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Configuration contents">
            {([['agents', 'Agents only'], ['columns', 'Columns only'], ['both', 'Agents and columns']] as const).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="transfer-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />{label}
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-6">
            {mode !== "columns" && <Selection title="Agents" items={source.agents.map((agent) => ({ id: agent.id, label: agent.name }))} selected={agents} onChange={setAgents} />}
            {mode !== "agents" && <Selection title="Columns" items={source.columns.map((column) => ({ id: column.id, label: column.name, detail: column.id }))} selected={columns} onChange={setColumns} />}
          </div>
          <p className="text-sm text-muted-foreground">Assignments are included only when both the column and its agent are selected. Other selected columns remain unassigned.</p>
          {operation === "import" && selected.columns.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">How should columns be imported?</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="column-import-mode" checked={columnMode === "add"} onChange={() => setColumnMode("add")} />Add imported columns</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="column-import-mode" checked={columnMode === "replace"} onChange={() => setColumnMode("replace")} />Replace all existing columns</label>
              {columnMode === "replace" && <p className="text-sm text-muted-foreground">All existing columns and their assignments will be removed. Existing tasks will move to “{selected.columns[0].name}” without starting agents. Queued or active runs must finish first. Existing agents will be kept.</p>}
            </fieldset>
          )}
          {operation === "import" && columnMode !== "replace" && conflictMode !== "overwrite" && <p className="text-sm text-muted-foreground">Import creates new agents and appends columns in file order. Conflicting column names receive an “imported” suffix. Existing agents, columns, tasks, and assignments stay unchanged.</p>}
          {conflicts.length > 0 && <fieldset className="space-y-2 rounded border p-3">
            <legend className="text-sm font-medium">Matching IDs found — overwrite existing entries?</legend>
            <ScrollArea className="max-h-40"><ul className="text-xs text-muted-foreground">{conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul></ScrollArea>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="conflicts" checked={conflictMode === "copy"} onChange={() => setConflictMode("copy")} />Keep existing entries and import new copies</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="conflicts" checked={conflictMode === "overwrite"} onChange={() => setConflictMode("overwrite")} />Overwrite entries with matching IDs</label>
            {conflictMode === "overwrite" && <p className="text-sm text-muted-foreground">Matching agents will receive the imported settings. Matching columns will receive the imported names and selected assignments; omitted assignments will be cleared. Replace all columns still removes every existing column.</p>}
          </fieldset>}
          <p className="text-sm" role="status">{selected.agents.length} agents, {selected.columns.length} columns, {selected.assignments.length} assignments selected.</p>
          <div className="flex gap-2">
            <Button disabled={busy || (conflicts.length > 0 && conflictMode === null) || (!selected.agents.length && !selected.columns.length) || (operation === "import" && selected.columns.length > 0 && columnMode === null)} onClick={() => run(async () => {
              if (operation === "import") {
                const result = await configurationApi.import(selected, columnMode ?? "add", conflicts.length ? conflictMode ?? "copy" : "copy");
                toast.success(`Imported ${result.agents} agents, ${result.columns} columns, and ${result.assignments} assignments.`);
                setSource(null);
                onImported();
              } else {
                const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = "todai-configuration.json";
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("Configuration exported.");
                setSource(null);
              }
            })}>{busy ? "Working…" : operation === "export" ? "Export selected" : "Import selected"}</Button>
            <Button variant="ghost" onClick={() => setSource(null)}>Cancel</Button>
          </div>
        </fieldset>
      );

  return (
    <Dialog open={source !== null && operation === "export"} onOpenChange={(open) => { if (!open && !pending.current) setSource(null); }}>
    <section className="space-y-4" aria-labelledby="transfer-heading">
      <div>
        <h2 id="transfer-heading" className="text-lg font-semibold">Export / import</h2>
        <p className="text-sm text-muted-foreground">Transfer agents, columns, or both using a JSON file. Choose individual entries before exporting or importing.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <DialogTrigger asChild><Button variant="outline" disabled={busy} onClick={() => run(async () => prepare(await configurationApi.get(), "export"))}><Download className="size-4" aria-hidden="true" />Export</Button></DialogTrigger>
        <div className="space-y-2">
          <label htmlFor="configuration-file" className="text-sm font-medium">Import configuration file</label>
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
              setExisting(await configurationApi.get());
              prepare(parsed, "import");
            });
          }} />
        </div>
      </div>
      {operation === "import" && selection}
      <DialogContent size="wide" closeDisabled={busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Export configuration</DialogTitle>
          <DialogDescription>Choose the agents and columns to include in your JSON file.</DialogDescription>
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
