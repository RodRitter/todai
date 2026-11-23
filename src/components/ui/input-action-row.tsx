import type { ReactNode } from "react";

/** Keep a field and its actions on one compact row. */
export function InputActionRow({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2">
    <div className="min-w-0 flex-1">{children}</div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>;
}
