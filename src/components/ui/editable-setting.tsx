"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Combobox } from "./combobox";
import { notifyOperation } from "./toast";

type Props = {
  id: string;
  label: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
  disabled?: boolean;
  describedBy?: string;
  type?: "text" | "number";
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  min?: number;
  initialEditing?: boolean;
  options?: readonly string[];
  onDraftChange?: (value: string) => void;
};

/** A saved value becomes a field only while the user edits it. */
export function EditableSetting({ id, label, value, onSave, disabled, describedBy, type = "text", multiline, required = true, maxLength, min, options, onDraftChange, initialEditing = false }: Props) {
  const [editing, setEditing] = useState(initialEditing);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const pending = useRef(false);
  const cancelled = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  async function commit(field: HTMLInputElement | HTMLTextAreaElement, restoreFocus = false) {
    if (pending.current || cancelled.current) return;
    const next = draft.trim();
    field.setCustomValidity(required && !next ? "Enter a value." : "");
    if (!field.checkValidity()) {
      setInvalid(true);
      field.reportValidity();
      return;
    }
    if (next === value.trim()) { setEditing(false); if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus()); return; }
    pending.current = true;
    setBusy(true);
    try {
      await notifyOperation(() => onSave(next), {
        loading: `Saving ${label.toLowerCase()}…`, success: `${label} saved.`,
        error: error => error instanceof Error ? error.message : `Could not save ${label.toLowerCase()}.`,
      });
      setEditing(false);
      if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus());
    } catch { /* Keep the draft. Enter or blur retries the save. */ }
    finally { pending.current = false; setBusy(false); }
  }

  if (!editing) return <Button ref={trigger} id={id} type="button" variant="ghost" size="row" weight="normal" disabled={disabled}
    aria-label={`Edit ${label.toLowerCase()}: ${value || "Not set"}`} aria-describedby={describedBy}
    onClick={() => { cancelled.current = false; setDraft(value); onDraftChange?.(value); setInvalid(false); setEditing(true); }}>
    <span className="min-w-0 flex-1 break-words">{value || "Not set"}</span><Pencil aria-hidden="true" />
  </Button>;

  const props = {
    id, value: draft, autoFocus: true, disabled: disabled || busy, required, maxLength,
    "aria-label": label, "aria-describedby": [describedBy, invalid ? `${id}-error` : undefined].filter(Boolean).join(" "), "aria-invalid": invalid, "aria-busy": busy,
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { void commit(event.currentTarget); },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); cancelled.current = true; setEditing(false);
        requestAnimationFrame(() => trigger.current?.focus());
      } else if (event.key === "Enter" && !multiline && !event.currentTarget.getAttribute("aria-activedescendant")) {
        event.preventDefault(); void commit(event.currentTarget, true);
      }
    },
  };
  function change(next: string) { setDraft(next); setInvalid(false); onDraftChange?.(next); }
  const control = options
    ? <Combobox {...props} options={options} filterOptions={false} closeOnSelect={false} onValueChange={change} />
    : multiline
      ? <Textarea {...props} onChange={event => { event.target.setCustomValidity(""); change(event.target.value); }} />
      : <Input {...props} type={type} min={min} step={type === "number" ? "any" : undefined} onChange={event => { event.target.setCustomValidity(""); change(event.target.value); }} />;
  return <div className="min-w-0 flex-1 space-y-2">{control}{invalid && <p id={`${id}-error`} className="text-sm text-destructive">Enter a valid value for {label.toLowerCase()}.</p>}</div>;
}
