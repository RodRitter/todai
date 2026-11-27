"use client";

import { useId, useRef, useState } from "react";
import type { Board } from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, useDialogExit } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyOperation } from "@/components/ui/toast";

export function BoardSettingsDialog({ board, disabled, onClose, onSave }: {
  board: Board;
  disabled?: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const exit = useDialogExit(onClose);
  const id = useId();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "Organize and track tasks on this board.");
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [returnFocus] = useState(() => typeof document === "undefined" ? null : document.activeElement);
  const busy = pending || disabled;
  return <Dialog open={exit.open} onOpenChange={(open) => { if (!busy && !open) exit.close(); }}>
    <DialogContent closeDisabled={busy} aria-describedby={undefined} onCloseAutoFocus={(event) => {
      exit.onCloseAutoFocus();
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) { event.preventDefault(); returnFocus.focus(); }
    }}>
      <DialogHeader><DialogTitle>Board settings</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (saving.current || disabled) return;
        saving.current = true;
        setPending(true);
        try {
          await notifyOperation(() => onSave(name.trim(), description.trim()), {
            loading: "Saving board settings…", success: "Board settings saved.",
            error: (error) => error instanceof Error ? error.message : "Could not save board settings.",
          });
          exit.close();
        } catch { /* Keep the form available for retry. The toast shows the error. */ }
        finally { saving.current = false; setPending(false); }
      }}>
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>Board name</Label>
          <Input id={`${id}-name`} required maxLength={80} disabled={busy} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2"><Label htmlFor={`${id}-description`}>Description</Label>
          <Textarea id={`${id}-description`} required maxLength={500} disabled={busy} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => exit.close()}>Cancel</Button>
          <Button size="sm" disabled={busy || !name.trim() || !description.trim()}>{busy ? "Saving…" : "Save settings"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
