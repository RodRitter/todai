"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";

type ScrollAreaProps = Omit<React.ComponentProps<typeof ScrollAreaPrimitive.Root>, "className"> & {
  className?: string;
  orientation?: "vertical" | "horizontal" | "both";
  fade?: "none" | "bottom" | "vertical";
  variant?: "default" | "table" | "code" | "modal";
  viewportProps?: Omit<React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>, "className" | "children">;
};

function ScrollArea({ className, children, orientation = "vertical", fade = "none", variant = "default", viewportProps, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn(
      "relative flex min-h-0 min-w-0 flex-col overflow-hidden",
      variant === "table" && "rounded-lg border",
      variant === "code" && "my-3 rounded-lg bg-muted [&_pre]:m-0! [&_pre]:overflow-visible!",
      className,
    )} {...props}>
      <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className={cn(
        "min-h-0 w-full flex-1 rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
        // Embedded content must pass scrolling to its parent at its boundaries.
        variant === "table" || variant === "code" ? "overscroll-auto" : "overscroll-contain",
        fade === "bottom" && "scroll-fade-b scroll-fade-12",
        fade === "vertical" && "scroll-fade-y scroll-fade-12",
        orientation === "vertical" && "overflow-x-hidden!",
        orientation === "horizontal" && "overflow-y-hidden!",
      )} {...viewportProps}>
        <ScrollAreaPrimitive.Content className={cn(
          orientation === "vertical" ? "min-w-0!" : "w-max min-w-full!",
          variant === "modal" && "grid gap-4 p-4",
        )}>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" && <ScrollBar />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({ className, orientation = "vertical", ...props }: Omit<React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>, "className"> & { className?: string }) {
  return <ScrollAreaPrimitive.Scrollbar data-slot="scroll-area-scrollbar" orientation={orientation} className={cn(
    "z-20 flex touch-none select-none p-px opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100 data-[hidden]:pointer-events-none data-[hidden]:opacity-0 motion-reduce:transition-none",
    orientation === "vertical" ? "w-2.5" : "h-2.5 flex-col",
    className,
  )} {...props}>
    <ScrollAreaPrimitive.Thumb data-slot="scroll-area-thumb" className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.Scrollbar>;
}

export { ScrollArea, ScrollBar };
