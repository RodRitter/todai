"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { notifyOperation } from "@/components/ui/toast";
import {
  AgentValidationError,
  executionTools,
  parseAgentProfile,
  type AgentProfile,
  type ExecutionTool,
  type ExecutorStatus,
} from "@/domain/column-agent";

export function AgentEditor({
  agent,
  defaultExecutor = "codex",
  executorStatuses = [],  onClose,
  onSave,
}: {
  agent?: AgentProfile;
  defaultExecutor?: ExecutionTool;
  executorStatuses?: ExecutorStatus[];
  onClose: () => void;
  onSave: (agent: AgentProfile) => Promise<void>;
}) {
  const [selectedTool, setSelectedTool] = useState(
    () =>
      executionTools.find((tool) => tool.value === (agent?.tool ?? defaultExecutor)) ??
      executionTools[0],
  );
  const [model, setModel] = useState(agent?.model ?? "");
  const [effort, setEffort] = useState<AgentProfile["effort"]>(agent?.effort ?? "medium");
  const [permissions, setPermissions] = useState<AgentProfile["permissions"]>(agent?.permissions ?? selectedTool.defaultPermissions);
  const draftId = useRef<string | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AgentValidationError | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const data = new FormData(event.currentTarget);
    let draft: AgentProfile;
    try {
      draft = parseAgentProfile({
        ...Object.fromEntries(data),
        id: agent?.id ?? (draftId.current ??= crypto.randomUUID()),
      });
    } catch (error) {
      setError(error as AgentValidationError);
      return;
    }
    setError(null);
    saving.current = true;
    setBusy(true);
    try {
      await notifyOperation(() => onSave(draft), {
        loading: "Saving agent…",
        success: "Agent saved.",
        error:
          "Could not save agent. Check local database access and try again. Your draft is still open.",
      });
      onClose();
    } catch {
      /* Keep the draft available for retry. */
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit agent" : "Create agent"}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure this reusable agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} noValidate className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                name="name"
                defaultValue={agent?.name ?? ""}
                required
                aria-invalid={error?.field === "name"}
                aria-describedby={
                  error?.field === "name" ? "agent-name-error" : undefined
                }
                onChange={() => setError(null)}
              />
              {error?.field === "name" && (
                <p
                  id="agent-name-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {error.message}
                </p>
              )}
            </div>
            <div
              role="group"
              aria-label="Execution settings"
              className="space-y-4 rounded-lg bg-muted/50 p-3"
            >
              <div className="space-y-2">
                <Label htmlFor="agent-tool">Execution tool</Label>
                <NativeSelect
                  id="agent-tool"
                  name="tool"
                  value={selectedTool.value}
                  onChange={(event) => {
                    const nextTool = executionTools.find(
                      (tool) => tool.value === event.target.value,
                    );
                    if (nextTool && nextTool.value !== selectedTool.value) {
                      setSelectedTool(nextTool);
                      setModel("");
                      setEffort("medium");
                      setPermissions(nextTool.defaultPermissions);
                      setError(null);
                    }
                  }}
                >
                  {executionTools.map((tool) => (
                    <option key={tool.value} value={tool.value}>
                      {tool.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-model">Model</Label>
                <Combobox
                  id="agent-model"
                  name="model"
                  options={selectedTool.models}
                  value={model}
                  required
                  disabled={busy}
                  placeholder="Select or enter a model"
                  aria-invalid={error?.field === "model"}
                  aria-describedby={
                    error?.field === "model" ? "agent-model-error" : undefined
                  }
                  onValueChange={(value) => {
                    setModel(value);
                    setError(null);
                  }}
                />
                {error?.field === "model" && (
                  <p
                    id="agent-model-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-effort">Effort</Label>
                <NativeSelect
                  id="agent-effort"
                  name="effort"
                  value={effort}
                  onChange={(event) => setEffort(event.target.value as AgentProfile["effort"])}
                >
                  {selectedTool.efforts.map((effort) => (
                    <option key={effort}>{effort}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Instructions</Label>
              <Textarea
                id="agent-instructions"
                name="instructions"
                defaultValue={agent?.instructions ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-permissions">Permissions</Label>
              <NativeSelect
                id="agent-permissions"
                name="permissions"
                value={permissions}
                onChange={(event) => setPermissions(event.target.value as AgentProfile["permissions"])}
                aria-describedby="agent-permissions-help"
              >
                {selectedTool.permissions.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </NativeSelect>
            </div>
            <p id="agent-permissions-help" className="text-xs text-muted-foreground">{selectedTool.permissionHelp}</p>
            {executorStatuses.filter((status) => status.tool === selectedTool.value && (!status.installed || !status.signedIn)).map((status) => <p key={status.tool} className="text-sm text-muted-foreground">{status.message}</p>)}
            <Link href="/settings?tab=executors" className="text-sm underline">Check executor availability in Settings</Link>
            {error && !error.field && (
              <p role="alert" className="text-sm text-destructive">
                {error.message}
              </p>
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save agent</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
