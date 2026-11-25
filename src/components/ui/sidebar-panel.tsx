import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function SidebarPanel({ variant = "main", className, ...props }: ComponentProps<"div"> & { variant?: "main" | "chat" }) {
  return <div data-slot="sidebar-panel" data-variant={variant} className={cn(
    "border-r bg-muted/40",
    variant === "main" ? "h-full w-16 md:w-60" : "flex min-h-0 w-full flex-1 flex-col border-b md:border-b-0",
    className,
  )} {...props} />;
}
