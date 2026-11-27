"use client";

import { useId, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, useDialogExit, useDialogSessionKey, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ColumnSettingsDialogProps = {
  column: string;
  instructions: string;
  completion?: boolean;
  open: boolean;
  disabled?: boolean;
  restoreFocus?: () => void;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, instructions: string, completion: boolean) => Promise<void>;
};

export function ColumnSettingsDialog(props: ColumnSettingsDialogProps) {
  const session = useDialogSessionKey(props.open);
  return <ColumnSettingsSession key={`${props.column}:${session}`} {...props} />;
}

function ColumnSettingsSession({ column, instructions, completion = false, open, disabled = false, restoreFocus, onOpenChange, onSave }: ColumnSettingsDialogProps) {
  const exit = useDialogExit(() => onOpenChange(false));
  const id = useId();
  const [name, setName] = useState(column);
  const [isCompletion, setCompletion] = useState(completion);
  const [draft, setDraft] = useState(instructions);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [returnFocus] = useState(() => typeof document === "undefined" ? null : document.activeElement);
  const busy = pending || disabled;
  return <Dialog open={open && exit.open} onOpenChange={(value) => { if (!busy && !value) exit.close(); }}>
    <DialogContent closeDisabled={busy} aria-describedby={`${id}-help`} onCloseAutoFocus={(event) => {
      exit.onCloseAutoFocus();
      if (restoreFocus) { event.preventDefault(); restoreFocus(); return; }
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) { event.preventDefault(); returnFocus.focus(); }
    }}>
      <DialogHeader><DialogTitle>Column settings</DialogTitle></DialogHeader>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">Set instructions for agents that work in this column. Changes apply when a run starts.</p>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (saving.current || disabled) return;
        saving.current = true; setPending(true);
        try { await notifyOperation(() => onSave(name.trim(), draft, isCompletion), { loading: "Saving column settings…", success: "Column settings saved.", error: (error) => error instanceof Error ? error.message : "Could not save column settings." }); exit.close(); }
        catch { /* The shared toast reports the failure. Keep the form available for retry. */ }
        finally { saving.current = false; setPending(false); }
      }}>
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>Column name</Label>
          <Input id={`${id}-name`} value={name} maxLength={80} required disabled={busy} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2"><Label htmlFor={`${id}-instructions`}>Custom instructions</Label>
          <Textarea id={`${id}-instructions`} value={draft} rows={6} maxLength={20000} disabled={busy} onChange={(event) => setDraft(event.target.value)} aria-describedby={`${id}-instructions-help`} />
          <p id={`${id}-instructions-help`} className="text-sm text-muted-foreground">Optional. These instructions supplement the assigned agent’s instructions. They do not grant approval or change workflow rules.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Switch id={`${id}-completion`} checked={isCompletion} onCheckedChange={setCompletion} disabled={busy} aria-describedby={`${id}-completion-help`} /><Label htmlFor={`${id}-completion`}>Completion column</Label></div>
          <p id={`${id}-completion-help`} className="text-sm text-muted-foreground">Tasks entering this column receive a built-in memory review instead of running the assigned agent. Enabling this setting unmarks the previous completion column on this board. Memory changes require human approval.</p>
        </div>
        <DialogFooter><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => exit.close()}>Cancel</Button><Button size="sm" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save settings"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
