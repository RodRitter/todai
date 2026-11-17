"use client";

import { useRef, useState } from "react";
import { FolderIcon } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { useDirectorySuggestions } from "./use-directory-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceApi } from "@/lib/workspace-api";

export function CreateWorkspace() {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const { suggestions, directoryError, clearSuggestions } = useDirectorySuggestions(path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  return <section className="space-y-4" aria-labelledby="add-workspace-heading">
    <div>
      <h2 id="add-workspace-heading" className="text-lg font-semibold">Add workspace</h2>
      <p className="text-sm text-muted-foreground">Start an empty board with default columns and settings. Existing work continues when you switch.</p>
    </div>
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      if (saving.current) return;
      saving.current = true;
      setBusy(true);
      setError("");
      try {
        const workspace = await workspaceApi.create(name, path);
        window.location.assign(`/?workspace=${encodeURIComponent(workspace.id)}`);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not create workspace.");
        saving.current = false;
        setBusy(false);
      }
    }}>
      <Label htmlFor="new-workspace-name">Name</Label>
      <Input id="new-workspace-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={busy} placeholder="My project" />
      <Label htmlFor="new-workspace-path">Working directory</Label>
      <Combobox
        id="new-workspace-path"
        value={path}
        options={suggestions}
        filterOptions={false}
        closeOnSelect={false}
        icon={FolderIcon}
        emptyMessage={directoryError || "No directory suggestions. Enter a path to continue."}
        onValueChange={(value) => {
          setPath(value);
          clearSuggestions();
        }}
        required
        disabled={busy}
        placeholder="~/Projects/my-project"
        spellCheck={false}
        aria-describedby="new-workspace-directory-error"
      />
      <p id="new-workspace-directory-error" className="text-xs text-muted-foreground" role="status">{directoryError}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || !name.trim() || !path.trim()}>{busy ? "Adding workspace…" : "Add and open workspace"}</Button>
    </form>
  </section>;
}
