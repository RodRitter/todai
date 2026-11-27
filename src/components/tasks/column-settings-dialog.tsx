"use client";

import { useId, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, useDialogExit, useDialogSessionKey, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EditableSetting } from "@/components/ui/editable-setting";
import { FieldHelp } from "@/components/ui/field-help";
import { Label } from "@/components/ui/label";

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
  return <ColumnSettingsSession key={session} {...props} />;
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
  async function save(nextName: string, nextDraft: string, nextCompletion: boolean) {
    if (saving.current || disabled) throw new Error("Wait for the current save to finish.");
    saving.current = true; setPending(true);
    try { await onSave(nextName, nextDraft, nextCompletion); setName(nextName); setDraft(nextDraft); setCompletion(nextCompletion); }
    finally { saving.current = false; setPending(false); }
  }
  return <Dialog open={open && exit.open} onOpenChange={(value) => { if (!busy && !value) exit.close(); }}>
    <DialogContent closeDisabled={busy} aria-describedby={`${id}-help`} onCloseAutoFocus={(event) => {
      exit.onCloseAutoFocus();
      if (restoreFocus) { event.preventDefault(); restoreFocus(); return; }
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) { event.preventDefault(); returnFocus.focus(); }
    }}>
      <DialogHeader><DialogTitle>Column settings</DialogTitle></DialogHeader>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">Click a value to edit it. Leave the field to save. Instructions apply when a run starts.</p>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>Column name</Label>
          <EditableSetting id={`${id}-name`} label="Column name" value={name} maxLength={80} disabled={busy} onSave={value => save(value, draft, isCompletion)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Label htmlFor={`${id}-instructions`}>Custom instructions</Label>
            <FieldHelp id={`${id}-instructions-help`} label="Custom instructions">Optional. These instructions supplement the assigned agent’s instructions. They do not grant approval or change workflow rules.</FieldHelp></div>
          <EditableSetting id={`${id}-instructions`} label="Custom instructions" multiline required={false} value={draft} maxLength={20000} disabled={busy} describedBy={`${id}-instructions-help`} onSave={value => save(name, value, isCompletion)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${id}-completion`} checked={isCompletion} disabled={busy} aria-describedby={`${id}-completion-help`} onCheckedChange={async value => {
            try { await notifyOperation(() => save(name, draft, value), { loading: "Saving completion column…", success: "Completion column saved.", error: error => error instanceof Error ? error.message : "Could not save completion column." }); }
            catch { /* Keep the saved selection. */ }
          }} /><Label htmlFor={`${id}-completion`}>Completion column</Label>
          <FieldHelp id={`${id}-completion-help`} label="Completion column">Only one column can complete tasks. Todai records reusable knowledge instead of running the assigned agent. With task worktrees enabled, completion commits changes and removes finished worktrees. Branches remain.</FieldHelp>
        </div>
        <DialogFooter><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => exit.close()}>Done</Button></DialogFooter>
      </div>
    </DialogContent>
  </Dialog>;
}
