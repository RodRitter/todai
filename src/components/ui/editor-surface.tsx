import type { ComponentProps } from "react";
import { InputGroup } from "./input-group";
import { cn } from "@/lib/utils";

// The editor owns its background, padding, and focus ring, including in preview mode.
export function EditorSurface({
  disabled = false,
  variant = "default",
  className,
  ...props
}: ComponentProps<"div"> & { disabled?: boolean; variant?: "default" | "prompt" }) {
  if (variant === "prompt") return <InputGroup data-disabled={disabled} className={cn("min-w-0 max-w-full h-auto flex-col items-stretch p-3 has-[[contenteditable=true]:focus-visible]:border-ring has-[[contenteditable=true]:focus-visible]:ring-3 has-[[contenteditable=true]:focus-visible]:ring-ring/50", className)} {...props} />;
  return (
    <div
      data-slot="editor-surface"
      className={cn(
        "min-w-0 max-w-full rounded-2xl bg-muted/60 p-4 outline-none transition-shadow motion-reduce:transition-none",
        disabled
          ? "cursor-not-allowed text-muted-foreground opacity-60"
          : "cursor-text focus-visible:ring-2 focus-visible:ring-ring/50 focus-within:ring-2 focus-within:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export const editorLabelClassName = "mb-2 block cursor-text text-sm font-medium text-muted-foreground";
