import type { ReactNode } from "react";
import { InputActionRow } from "@/components/ui/input-action-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserNameField({ id, value, onChange, disabled, actions }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; actions?: ReactNode }) {
  return <div className="space-y-2">
    <Label htmlFor={id}>Your name</Label>
    <InputActionRow actions={actions}><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} required maxLength={100} autoComplete="name" disabled={disabled} aria-describedby={`${id}-hint`} /></InputActionRow>
    <Label asChild variant="metadata"><p id={`${id}-hint`}>Agents use this name to refer to you. New comments and chat messages use it as the author name across all workspaces.</p></Label>
  </div>;
}
