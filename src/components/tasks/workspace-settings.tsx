"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { workspaceApi } from "@/lib/workspace-api";
import { useDirectorySuggestions } from "./use-directory-suggestions";
import { EditableSetting } from "@/components/ui/editable-setting";
import { Switch } from "@/components/ui/switch";
import { SettingField } from "@/components/ui/setting-field";
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
    <section className="space-y-4" aria-label="Directory and worktrees">
      {!failed && <SettingField htmlFor="workspace-worktrees" label="Use task worktrees">
          <Switch id="workspace-worktrees" checked={worktreesEnabled} disabled={saved === null || busy}

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
      </SettingField>}
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
        <SettingField htmlFor="workspace-path" label="Directory">
          <EditableSetting id="workspace-path" label="Directory" value={saved ?? ""} options={suggestions} disabled={saved === null || busy}
            describedBy="workspace-directory-error" onDraftChange={value => { setPath(value); clearSuggestions(); }}
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
        </SettingField>
      )}
    </section>
  );
}
