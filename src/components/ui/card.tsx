import * as React from "react";
import { cn } from "@/lib/utils";

function Card({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "compact" | "task";
}) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl border border-border/40 shadow-[0_2px_3px_-1px_rgb(0_0_0/0.03),0_8px_18px_-8px_rgb(0_0_0/0.12)]",
        variant === "compact"
          ? "gap-3 py-3 [&>[data-slot=card-header]]:px-3 [&>[data-slot=card-footer]]:px-3"
          : variant === "task"
            ? "gap-5 py-5"
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
