import { FieldHelp } from "@/components/ui/field-help";
import type { ReactNode } from "react";
import { InputActionRow } from "@/components/ui/input-action-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserNameField({ id, value, onChange, disabled, actions }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; actions?: ReactNode }) {
  return <div className="space-y-2">
    <div className="flex items-center gap-2"><Label htmlFor={id}>Your name</Label><FieldHelp id={`${id}-hint`} label="Your name">Agents use this name for you. It is the author name for new comments and messages in all workspaces.</FieldHelp></div>
    <InputActionRow actions={actions}><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} required maxLength={100} autoComplete="name" disabled={disabled} aria-describedby={`${id}-hint`} /></InputActionRow>

  </div>;
}
