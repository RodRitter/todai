import * as React from "react";
import { cn } from "@/lib/utils";

function Card({
  className,
  variant = "default",
  elevation = "default",
  tone = "default",
  interactive = false,
  dragging = false,
  attention = false,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "compact" | "task" | "flush";
  elevation?: "default" | "flat";
  tone?: "default" | "muted";
  interactive?: boolean;
  dragging?: boolean;
  attention?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl border border-border/40 shadow-[0_2px_3px_-1px_rgb(0_0_0/0.03),0_8px_18px_-8px_rgb(0_0_0/0.12)]",
        interactive && "relative cursor-pointer overflow-hidden outline-none transition-[box-shadow,border-color,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] active:cursor-grabbing motion-reduce:transition-none",
        interactive && !dragging && "hover:border-ring/30 hover:shadow-md",
        dragging && "opacity-40",
        attention && "relative before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-destructive",
        elevation === "flat" && "shadow-none",
        tone === "muted" && "bg-muted/50 text-foreground",
        variant === "flush" ? "gap-0 overflow-hidden py-0" : variant === "compact"
          ? "gap-3 py-3 [&>[data-slot=card-header]]:px-3 [&>[data-slot=card-footer]]:px-3"
          : variant === "task"
            ? "gap-3 py-4 [&>[data-slot=card-header]]:gap-1.5 [&>[data-slot=card-header]]:px-4 [&>[data-slot=card-footer]]:justify-between [&>[data-slot=card-footer]]:px-4 [&_[data-slot=card-title]]:line-clamp-3 [&_[data-slot=card-title]]:text-sm [&_[data-slot=card-title]]:leading-5 [&_[data-slot=card-title]]:font-semibold [&_[data-slot=card-description]]:line-clamp-2 [&_[data-slot=card-description]]:max-h-10 [&_[data-slot=card-description]]:leading-5"
            : "gap-6 py-6",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-5",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base leading-snug font-medium wrap-anywhere", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm leading-6 wrap-anywhere", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex flex-wrap items-center gap-2 px-5", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardFooter };
