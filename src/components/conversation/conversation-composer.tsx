import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ConversationComposer({ variant = "inline", className, children, floatingActions, ...props }: ComponentProps<"div"> & { variant?: "inline" | "fixed"; floatingActions?: ReactNode }) {
  return <div data-slot="conversation-composer" data-variant={variant} className={cn(
    "relative min-w-0 shrink-0",
    variant === "fixed" && "z-10 bg-background pt-2",
    className,
  )} {...props}>
    {floatingActions && <div data-slot="conversation-scroll-controls" className="absolute right-0 bottom-full z-10 mb-2 flex gap-1">{floatingActions}</div>}
    {children}
  </div>;
}
