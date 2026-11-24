import type { ComponentProps } from "react";

export function VSCodeIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.583 2.074a1.5 1.5 0 0 0-1.712.291L6.45 10.96 2.345 7.846a1 1 0 0 0-1.277.057l-.737.67a1 1 0 0 0-.001 1.48L3.89 12 .33 13.947a1 1 0 0 0 .001 1.48l.737.67a1 1 0 0 0 1.277.057L6.45 13.04l9.421 8.595a1.5 1.5 0 0 0 1.712.291l5.5-2.646a1.5 1.5 0 0 0 .917-1.382V6.102a1.5 1.5 0 0 0-.917-1.382zM18 6.5v11L10 12z" />
    </svg>
  );
}
