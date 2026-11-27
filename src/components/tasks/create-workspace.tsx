"use client";

import { useId, useRef, useState } from "react";
import { FolderIcon } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { useDirectorySuggestions } from "./use-directory-suggestions";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceApi } from "@/lib/workspace-api";
import { statuses } from "@/domain/task";
import { parseWorkspaceSetup, starterAgents } from "@/domain/workspace-setup";
import { UserNameField } from "./user-name-field";
import { ColumnEditor } from "./column-editor";

export function CreateWorkspace({ firstRun = false, onBusyChange }: { firstRun?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const id = useId();
  const [columns, setColumns] = useState<string[]>([...statuses]);
  const [editingColumns, setEditingColumns] = useState(false);
  const [starterAgentIds, setStarterAgentIds] = useState<string[]>([]);
  const [userName, setUserName] = useState("");
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const { suggestions, directoryError, clearSuggestions } = useDirectorySuggestions(path);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  async function updateColumns(next: string[]) {
    const setup = parseWorkspaceSetup({ columns: next, starterAgentIds });
    setColumns(setup.columns);
    return setup.columns;
  }

  return <section className="space-y-6" aria-label="Create workspace">
    {!firstRun && <h2 className="text-lg font-semibold">Add workspace</h2>}
    <form id={`${id}-form`} className="grid gap-4 sm:grid-cols-2" onSubmit={async (event) => {
      event.preventDefault();
      if (saving.current || editingColumns) return;
      saving.current = true;
      setBusy(true);
      onBusyChange?.(true);
      try {
        const workspace = await notifyOperation(() => workspaceApi.create(name, path, parseWorkspaceSetup({ columns, starterAgentIds, ...(firstRun ? { userName } : {}) })), {
          loading: "Creating workspace…",
          success: "Workspace created.",
          error: (error) => error instanceof Error ? error.message : "Could not create workspace.",
        });
        window.location.assign(`/?workspace=${encodeURIComponent(workspace.id)}`);
      } catch {
        saving.current = false;
        setBusy(false);
        onBusyChange?.(false);
      }
    }}>
      {firstRun && <div className="sm:col-span-2"><UserNameField id={`${id}-user-name`} value={userName} onChange={setUserName} disabled={busy} /></div>}
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Workspace name</Label>
        <Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} required disabled={busy} placeholder="My project" />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-path`}>Project folder</Label>
        <Combobox
          id={`${id}-path`}
          value={path}
          options={suggestions}
          filterOptions={false}
          closeOnSelect={false}
          icon={FolderIcon}
          emptyMessage={directoryError || "No matching folders"}
          onValueChange={(value) => { setPath(value); clearSuggestions(); }}
          required
          disabled={busy}
          placeholder="~/Projects/my-project"
          spellCheck={false}
          aria-describedby={directoryError ? `${id}-directory-error` : undefined}
        />
        {directoryError && <p id={`${id}-directory-error`} className="text-xs text-destructive" role="status">{directoryError}</p>}
      </div>
    </form>
    <ColumnEditor
      compact
      disabled={busy}
      initialColumns={columns}
      onEditingChange={setEditingColumns}
      create={(name) => updateColumns([...columns, name])}
      reorder={updateColumns}
      rename={(column, name) => updateColumns(columns.map((current) => current === column ? name : current))}
      remove={(column) => updateColumns(columns.filter((current) => current !== column))}
    />
    <fieldset disabled={busy} className="space-y-3">
      <legend className="text-sm font-semibold">Starter agents <span className="font-normal text-muted-foreground">· Optional</span></legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {starterAgents.map((agent) => <label key={agent.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="checkbox" className="mt-1 accent-primary" checked={starterAgentIds.includes(agent.id)} onChange={(event) => setStarterAgentIds((current) => event.target.checked ? [...current, agent.id] : current.filter((id) => id !== agent.id))} />
          <span><span className="block text-sm font-medium">{agent.name}</span><span className="block text-xs text-muted-foreground">{agent.id === "planner" ? "Plan tasks" : agent.id === "builder" ? "Implement changes" : "Review work"}</span></span>
        </label>)}
      </div>
    </fieldset>
    <Button type="submit" form={`${id}-form`} className="w-full" disabled={busy || editingColumns || (firstRun && !userName.trim()) || !name.trim() || !path.trim()}>{busy ? "Creating workspace…" : "Create workspace"}</Button>
  </section>;
}
