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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { notifyOperation } from "@/components/ui/toast";
import { executorLabel, type AgentProfile } from "@/domain/column-agent";
import type { Status } from "@/domain/task";

export function ColumnAgentPicker({
  column,
  agents,
  agentId,
  onClose,
  onSave,
}: {
  column: Status;
  agents: AgentProfile[];
  agentId?: string;
  onClose: () => void;
  onSave: (agentId: string | null) => Promise<void>;
}) {
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const selected = String(
      new FormData(event.currentTarget).get("agentId") ?? "",
    );
    saving.current = true;
    setBusy(true);
    try {
      await notifyOperation(() => onSave(selected || null), {
        loading: "Saving agent assignment…",
        success: selected ? "Agent assigned." : "Agent removed from column.",
        error:
          "Could not save assignment. Reload to check available agents, or try again.",
      });
      onClose();
    } catch {
      /* Preserve selection for retry. */
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent for {column}</DialogTitle>
          <DialogDescription>
            Choose a saved agent for this column. Removing it here keeps the
            agent in your library.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="column-agent">Assigned agent</Label>
              <NativeSelect
                id="column-agent"
                name="agentId"
                defaultValue={agentId ?? ""}
                className="max-w-full"
              >
                <option value="">No agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} · {executorLabel(agent.tool)} · {agent.model}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {!agents.length && (
              <p className="text-sm text-muted-foreground">
                Create an agent before assigning one to this column.
              </p>
            )}
            <Link href="/agents" className="text-sm underline">
              Manage agents
            </Link>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save assignment</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
