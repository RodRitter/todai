"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { workspaceApi } from "@/lib/workspace-api";
import { FolderIcon } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { notifyOperation, toast } from "@/components/ui/toast";

export function WorkspaceSettings() {
  const [saved, setSaved] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [directoryError, setDirectoryError] = useState("");
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

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        workspaceApi
          .directories(path, controller.signal)
          .then((data) => {
            if (!controller.signal.aborted) {
              setSuggestions(data);
              setDirectoryError("");
            }
          })
          .catch((error) => {
            if (!controller.signal.aborted) {
              setSuggestions([]);
              setDirectoryError(error.message);
            }
          });
      },
      path.endsWith("/") ? 0 : 180,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path]);

  return (
    <section className="space-y-4" aria-labelledby="workspace-heading">
      <div>
        <h2 id="workspace-heading" className="text-lg font-semibold">
          Workspace
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose the directory where agents work. Changes apply to the next run;
          active runs keep their current directory.
        </p>
      </div>
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
                setSuggestions([]);
                setDirectoryError("");
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
