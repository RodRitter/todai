"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { workspaceApi } from "@/lib/workspace-api";
import { useDirectorySuggestions } from "./use-directory-suggestions";
import { FolderIcon } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { notifyOperation, toast } from "@/components/ui/toast";

export function WorkspaceSettings() {
  const [saved, setSaved] = useState<string | null>(null);
  const [worktreesEnabled, setWorktreesEnabled] = useState(false);
  const [path, setPath] = useState("");
  const { suggestions, directoryError, clearSuggestions } = useDirectorySuggestions(path);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    const id = toast.loading("Loading workspace settings…");
    workspaceApi
      .get()
      .then((data) => {
        if (active) {
          setSaved(data.path);
          setPath(data.path);
          setWorktreesEnabled(data.worktreesEnabled ?? false);
          setFailed(false);
          toast.dismiss(id);
        }
      })
      .catch((error) => {
        if (active) {
          setFailed(true);
          toast.error(error.message, { id, duration: Infinity });
        }
      });
    return () => {
      active = false;
      toast.dismiss(id);
    };
  }, [attempt]);


  return (
    <section className="space-y-4" aria-labelledby="workspace-heading">
      <div>
        <h2 id="workspace-heading" className="text-lg font-semibold">
          Workspace
        </h2>
        <p className="text-sm text-muted-foreground">
          Stop any running agent, or pause the queue from the header, before changing
          this directory. Saving keeps the queue paused. Resume queue will ask you to
          confirm the new directory for affected queued jobs.
        </p>
      </div>
      {!failed && <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Switch id="workspace-worktrees" checked={worktreesEnabled} disabled={saved === null || busy}
            aria-describedby="workspace-worktrees-hint"
            onCheckedChange={async (enabled) => {
              if (saving.current) return;
              saving.current = true;
              setBusy(true);
              try {
                const result = await notifyOperation(() => workspaceApi.saveWorktrees(enabled), {
                  loading: "Saving task worktree setting…", success: "Task worktree setting saved.",
                  error: (error) => error instanceof Error ? error.message : "Could not save task worktree setting.",
                });
                setWorktreesEnabled(result.worktreesEnabled);
              } catch {
                /* The toast reports the error. Keep the saved setting. */
              } finally { saving.current = false; setBusy(false); }
            }} />
          <Label htmlFor="workspace-worktrees">Use task worktrees</Label>
        </div>
        <p id="workspace-worktrees-hint" className="text-sm text-muted-foreground">
          Off by default. When off, agents edit this directory and leave changes uncommitted.
          When on, tasks use separate Git worktrees. Moving a task to Done commits its changes and removes its worktree.
          Existing worktrees remain intact while this setting is off. Stop agents and wait for chats before changing this setting.
        </p>
      </div>}
      {failed ? (
        <Button
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Retry loading workspace
        </Button>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving.current || saved === null) return;
            saving.current = true;
            setBusy(true);
            try {
              const result = await notifyOperation(
                () => workspaceApi.save(path),
                {
                  loading: "Saving workspace…",
                  success: "Workspace saved.",
                  error: (error) =>
                    error instanceof Error
                      ? error.message
                      : "Could not save workspace.",
                },
              );
              setSaved(result.path);
              setPath(result.path);
            } catch {
              /* Preserve the path for retry; the toast reports the error. */
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          <Label htmlFor="workspace-path">Directory</Label>
          <div className="flex gap-2">
            <Combobox
              id="workspace-path"
              value={path}
              options={suggestions}
              filterOptions={false}
              closeOnSelect={false}
              icon={FolderIcon}
              emptyMessage={
                directoryError ||
                "No directory suggestions. Enter a path to continue."
              }
              onValueChange={(value) => {
                setPath(value);
                clearSuggestions();
              }}
              spellCheck={false}
              placeholder="~/Projects/"
              required
              disabled={saved === null || busy}
              aria-describedby="workspace-hint workspace-directory-error"
            />
            <Button
              type="submit"
              disabled={
                saved === null || busy || !path.trim() || path === saved
              }
            >
              Save
            </Button>
          </div>
          <p id="workspace-hint" className="text-xs text-muted-foreground">
            Type a path for directory suggestions. Use ~/ for your home folder
            and a trailing / to browse inside a folder.
          </p>
          <p
            id="workspace-directory-error"
            className="text-xs text-muted-foreground"
            role="status"
          >
            {directoryError}
          </p>
        </form>
      )}
    </section>
  );
}
