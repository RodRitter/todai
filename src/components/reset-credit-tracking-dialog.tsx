"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ResetCreditTrackingDialog({ open, busy, onOpenChange, onConfirm }: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent layout="prompt" closeDisabled={busy}>
      <DialogHeader>
        <DialogTitle>Reset tracked credits?</DialogTitle>
        <DialogDescription>This sets the current workspace total to zero. Task usage history stays available.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="button" size="sm" disabled={busy} onClick={onConfirm}>{busy ? "Resetting…" : "Reset to zero"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
