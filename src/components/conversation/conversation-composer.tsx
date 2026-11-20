import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ConversationComposer({ variant = "inline", className, ...props }: ComponentProps<"div"> & { variant?: "inline" | "fixed" }) {
  return <div data-slot="conversation-composer" data-variant={variant} className={cn(
    "min-w-0 shrink-0",
    variant === "fixed" && "relative z-10 bg-background pt-4 shadow-[0_-6px_16px_-10px] shadow-foreground/20",
    className,
  )} {...props} />;
}
