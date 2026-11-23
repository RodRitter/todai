"use client";
import type { ComponentProps } from "react";
import { Popover as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export function PopoverContent({ className, children, size = "default", layout = "padded", ...props }: ComponentProps<typeof Primitive.Content> & { size?: "default" | "wide"; layout?: "padded" | "sections" }) {
  return <Primitive.Portal><Primitive.Content align="end" sideOffset={8} {...props} className={cn(
    "z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none",
    layout === "padded" && "space-y-3 p-4",
    size === "wide" ? "w-96" : "w-64", className,
  )}>{children}</Primitive.Content></Primitive.Portal>;
}

export function PopoverHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-4 pb-2"><h2 className="text-sm font-semibold">{children}</h2></div>;
}
export function PopoverBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 px-4 pt-2 pb-4">{children}</div>;
}
