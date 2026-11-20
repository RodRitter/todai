"use client";

import { useRef } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "./dialog";
import { Alert } from "./alert";

export function DeleteConfirmation({
  open,
  onOpenChange,
  title,
  description,
  busy,
  disabled = false,
  error,
  onConfirm,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy: boolean;
  disabled?: boolean;
  error?: string;
  onConfirm: () => void;
  confirmLabel?: string;
  busyLabel?: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!busy) onOpenChange(value);
    }}>
      <DialogContent
        layout="prompt"
        closeDisabled={busy}
        onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}
        aria-busy={busy}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="error" title={error} />}
        <DialogFooter>
          <DialogClose asChild>
            <Button ref={cancelRef} type="button" size="sm" variant="outline" disabled={busy}>Cancel</Button>
          </DialogClose>
          <Button type="button" size="sm" variant="ghost-destructive" disabled={busy || disabled} onClick={onConfirm}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
