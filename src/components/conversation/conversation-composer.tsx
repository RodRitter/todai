import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ConversationComposer({ variant = "inline", className, ...props }: ComponentProps<"div"> & { variant?: "inline" | "fixed" }) {
  return <div data-slot="conversation-composer" data-variant={variant} className={cn(
    "min-w-0 shrink-0",
    variant === "fixed" && "relative z-10 bg-background pt-2",
    className,
  )} {...props} />;
}
