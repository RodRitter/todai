"use client";
import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
function Label({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { variant?: "default" | "metadata" | "caption" }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        variant === "metadata" && "gap-3 leading-snug font-normal text-muted-foreground",
        variant === "caption" && "block truncate text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
export { Label };
