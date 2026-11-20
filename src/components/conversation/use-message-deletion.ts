"use client";

import { useRef, useState } from "react";

// Both presentations use the same confirmation, retry, and focus lifecycle.
export function useMessageDeletion<T>({ disabled, onDelete, onDeleted }: {
  disabled: boolean;
  onDelete: (target: T) => Promise<void>;
  onDeleted?: () => void;
}) {
  const [selection, setSelection] = useState<{ target: T; trigger: HTMLElement | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  function request(target: T, trigger: HTMLElement | null) {
    if (disabled || pending.current) return;
    setError("");
    setSelection({ target, trigger });
  }
  function onOpenChange(open: boolean) {
    if (open || pending.current) return;
    setSelection(null);
    setError("");
    selection?.trigger?.focus();
  }
  async function confirm() {
    if (!selection || disabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onDelete(selection.target);
      setSelection(null);
      onDeleted?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete message.");
    } finally { pending.current = false; setBusy(false); }
  }
  return { target: selection?.target, request, busy, confirmation: {
    open: selection !== null, onOpenChange, busy, disabled, error, onConfirm: () => void confirm(),
  } };
}
