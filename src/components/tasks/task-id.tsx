import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function TaskMetadataText({ weight = "medium", variant = "text", ...props }: Omit<ComponentProps<"span">, "className"> & { weight?: "medium" | "normal"; variant?: "text" | "badge" }) {
  return <span className={cn("block text-xs text-muted-foreground tabular-nums", weight === "normal" ? "font-normal" : "font-medium", variant === "badge" && "inline-flex whitespace-nowrap rounded-sm bg-muted px-1.5 py-0.5")} {...props} />;
}

export function TaskId({ number }: { number?: number }) {
  if (number === undefined) return null;
  return <TaskMetadataText>TASK-{number}</TaskMetadataText>;
}
