"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ColumnSettingsDialogProps = {
  column: string;
  instructions: string;
  open: boolean;
  disabled?: boolean;
  restoreFocus?: () => void;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, instructions: string) => Promise<void>;
};

export function ColumnSettingsDialog(props: ColumnSettingsDialogProps) {
  return <ColumnSettingsSession key={`${props.column}:${props.open}`} {...props} />;
}

function ColumnSettingsSession({ column, instructions, open, disabled = false, restoreFocus, onOpenChange, onSave }: ColumnSettingsDialogProps) {
  const id = useId();
  const [name, setName] = useState(column);
  const [draft, setDraft] = useState(instructions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const [returnFocus] = useState(() => typeof document === "undefined" ? null : document.activeElement);
  const busy = pending || disabled;
  return <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
    <DialogContent closeDisabled={busy} aria-describedby={`${id}-help`} onCloseAutoFocus={(event) => {
      if (restoreFocus) { event.preventDefault(); restoreFocus(); return; }
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) { event.preventDefault(); returnFocus.focus(); }
    }}>
      <DialogHeader><DialogTitle>Column settings</DialogTitle></DialogHeader>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">Set instructions for agents that work in this column. Changes apply when a run starts.</p>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (saving.current || disabled) return;
        saving.current = true; setPending(true); setError("");
        try { await onSave(name.trim(), draft); onOpenChange(false); }
        catch (error) { setError(error instanceof Error ? error.message : "Could not save column settings."); }
        finally { saving.current = false; setPending(false); }
      }}>
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>Column name</Label>
          <Input id={`${id}-name`} value={name} maxLength={80} required disabled={busy} onChange={(event) => setName(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        <div className="space-y-2"><Label htmlFor={`${id}-instructions`}>Custom instructions</Label>
          <Textarea id={`${id}-instructions`} value={draft} rows={6} maxLength={20000} disabled={busy} onChange={(event) => setDraft(event.target.value)} aria-describedby={`${id}-instructions-help`} />
          <p id={`${id}-instructions-help`} className="text-sm text-muted-foreground">Optional. These instructions supplement the assigned agent’s instructions. They do not grant approval or change workflow rules.</p>
        </div>
        {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button><Button size="sm" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save settings"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
