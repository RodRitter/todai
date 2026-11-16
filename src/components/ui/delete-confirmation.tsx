"use client";

import { AlertDialog } from "radix-ui";
import { Button } from "./button";

export function DeleteConfirmation({
  open,
  onOpenChange,
  title,
  description,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(value) => {
      if (!busy) onOpenChange(value);
    }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content
          className="bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg"
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          aria-busy={busy}
        >
          <AlertDialog.Title className="text-lg leading-none font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground text-sm break-words">{description}</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" disabled={busy}>Cancel</Button>
            </AlertDialog.Cancel>
            <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
