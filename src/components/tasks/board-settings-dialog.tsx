"use client";

import { useId, useRef, useState } from "react";
import type { Board } from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, useDialogExit } from "@/components/ui/dialog";
import { EditableSetting } from "@/components/ui/editable-setting";
import { Label } from "@/components/ui/label";

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
  async function save(nextName: string, nextDescription: string) {
    if (saving.current || disabled) throw new Error("Wait for the current save to finish.");
    saving.current = true; setPending(true);
    try { await onSave(nextName, nextDescription); setName(nextName); setDescription(nextDescription); }
    finally { saving.current = false; setPending(false); }
  }
  return <Dialog open={exit.open} onOpenChange={(open) => { if (!busy && !open) exit.close(); }}>
    <DialogContent closeDisabled={busy} aria-describedby={undefined} onCloseAutoFocus={(event) => {
      exit.onCloseAutoFocus();
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) { event.preventDefault(); returnFocus.focus(); }
    }}>
      <DialogHeader><DialogTitle>Board settings</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Click a value to edit it. Leave the field to save. Escape cancels edits.</p>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>Board name</Label>
          <EditableSetting id={`${id}-name`} label="Board name" value={name} maxLength={80} disabled={busy} onSave={value => save(value, description)} />
        </div>
        <div className="space-y-2"><Label htmlFor={`${id}-description`}>Description</Label>
          <EditableSetting id={`${id}-description`} label="Description" multiline value={description} maxLength={500} disabled={busy} onSave={value => save(name, value)} />
        </div>
        <DialogFooter><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => exit.close()}>Done</Button></DialogFooter>
      </div>
    </DialogContent>
  </Dialog>;
}
