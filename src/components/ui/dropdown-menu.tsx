"use client";
import type { ComponentProps } from "react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn("space-y-1 break-words px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
}
export function DropdownMenuContent({ className, sideOffset = 4, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} className={cn("z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props} /></Primitive.Portal>;
}
export function DropdownMenuItem({ className, variant = "default", ...props }: ComponentProps<typeof Primitive.Item> & { variant?: "default" | "destructive" }) {
  return <Primitive.Item className={cn("flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4", variant === "destructive" && "text-destructive focus:bg-destructive/10 focus:text-destructive", className)} {...props} />;
}
