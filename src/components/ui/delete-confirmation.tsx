"use client";

import { AlertDialog } from "radix-ui";
import { Button } from "./button";
import { ModalHeader, ModalCloseButton, modalTitleClassName, modalContentClassName } from "./dialog";

export function DeleteConfirmation({
  open,
  onOpenChange,
  title,
  description,
  busy,
  disabled = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy: boolean;
  disabled?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(value) => {
      if (!busy) onOpenChange(value);
    }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content
          className={modalContentClassName}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          aria-busy={busy}
        >
          <ModalHeader>
            <AlertDialog.Cancel asChild>
              <ModalCloseButton disabled={busy} />
            </AlertDialog.Cancel>
            <AlertDialog.Title className={modalTitleClassName}>{title}</AlertDialog.Title>
          </ModalHeader>
          <AlertDialog.Description className="text-muted-foreground text-sm break-words">{description}</AlertDialog.Description>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" disabled={busy}>Cancel</Button>
            </AlertDialog.Cancel>
            <Button type="button" variant="destructive" disabled={busy || disabled} onClick={onConfirm}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
