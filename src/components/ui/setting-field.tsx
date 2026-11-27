import type { ReactNode } from "react";
import { Label } from "./label";

export function SettingField({ label, htmlFor, children }: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    <div className="min-w-0 space-y-2">{children}</div>
  </div>;
}
