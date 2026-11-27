"use client";

import { useEffect, useRef, useState } from "react";
import { FieldHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { workspaceApi } from "@/lib/workspace-api";
import { useDirectorySuggestions } from "./use-directory-suggestions";
import { EditableSetting } from "@/components/ui/editable-setting";
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
          Directory and task worktrees
        </h2>
        <p className="text-sm text-muted-foreground">
          Stop running agents or pause the queue before changing the directory. Saving keeps the queue paused. Stop agents and wait for chats before changing task worktrees.
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
          <FieldHelp id="workspace-worktrees-hint" label="Use task worktrees">When enabled, tasks use separate Git worktrees. Completion commits changes and removes finished worktrees. Branches remain. When disabled, agents edit this directory without commits. Existing worktrees remain.</FieldHelp>
        </div>

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
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Label htmlFor="workspace-path">Directory</Label>
            <FieldHelp id="workspace-hint" label="Directory">Use ~/ for your home folder. Add / to see folders inside a directory. Resume queue asks you to confirm the new directory for affected jobs.</FieldHelp></div>
          <EditableSetting id="workspace-path" label="Directory" value={saved ?? ""} options={suggestions} disabled={saved === null || busy}
            describedBy="workspace-hint workspace-directory-error" onDraftChange={value => { setPath(value); clearSuggestions(); }}
            onSave={async value => {
              if (saving.current) throw new Error("Wait for the current save to finish.");
              saving.current = true; setBusy(true);
              try { const result = await workspaceApi.save(value); setSaved(result.path); setPath(result.path); }
              finally { saving.current = false; setBusy(false); }
            }} />
          <p
            id="workspace-directory-error"
            className="text-xs text-muted-foreground"
            role="status"
          >
            {directoryError}
          </p>
        </div>
      )}
    </section>
  );
}
