import type { ComponentProps } from "react";
import { InputGroup } from "./input-group";
import { cn } from "@/lib/utils";

// The editor owns its background, padding, and focus ring, including in preview mode.
export function EditorSurface({
  disabled = false,
  collapsed = false,
  variant = "default",
  className,
  ...props
}: ComponentProps<"div"> & { disabled?: boolean; collapsed?: boolean; variant?: "default" | "prompt" | "compact" | "reply" }) {
  if (variant !== "default") return <InputGroup data-disabled={disabled} className={cn("min-w-0 max-w-full h-auto flex-col items-stretch has-[[contenteditable=true]:focus-visible]:border-ring has-[[contenteditable=true]:focus-visible]:ring-3 has-[[contenteditable=true]:focus-visible]:ring-ring/50", variant === "compact" || variant === "reply" ? "p-2" : "p-3",
    (variant === "reply" || variant === "prompt") && "has-[[contenteditable=true]:focus-visible]:ring-inset overflow-clip [interpolate-size:allow-keywords] transition-[height,box-shadow] duration-200 ease-out motion-reduce:transition-none [&_.tiptap]:leading-5",
    collapsed && "h-10 p-2", className)} {...props} />;
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
