"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Button } from "./button";
import { cn } from "@/lib/utils";

// Local Radix adaptation of shadcn's Trace / Chain of Thought composition.
export function Trace({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="trace" className={cn("min-w-0 space-y-3", className)} {...props} />;
}

export const TraceCollapsible = Collapsible;

export function TraceCollapsibleTrigger({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  return <CollapsibleTrigger asChild>
    <Button type="button" variant="ghost-muted" size="row" className={cn("group/trace-trigger", className)} {...props}>
      {children}
      <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/trace-trigger:rotate-90 motion-reduce:transition-none" />
    </Button>
  </CollapsibleTrigger>;
}

export function TraceCollapsibleContent({ className, keepMounted = false, ...props }: React.ComponentProps<typeof CollapsibleContent> & { keepMounted?: boolean }) {
  return <CollapsibleContent forceMount={keepMounted ? true : undefined} className={cn("min-w-0 space-y-3 pl-5 data-[state=closed]:hidden", className)} {...props} />;
}

const traceLineVariants = cva("relative flex min-w-0 flex-wrap items-start gap-2 text-sm", {
  variants: { status: {
    complete: "text-foreground",
    running: "text-primary",
    pending: "text-muted-foreground",
    error: "text-destructive",
  } },
  defaultVariants: { status: "complete" },
});

export function TraceLine({ className, status, ...props }: React.ComponentProps<"div"> & VariantProps<typeof traceLineVariants>) {
  return <div data-slot="trace-line" data-status={status} className={cn(traceLineVariants({ status }), className)} {...props} />;
}

export function TraceIcon({ className, ...props }: React.ComponentProps<"span">) {
  return <span aria-hidden="true" className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center [&_svg]:size-4", className)} {...props} />;
}

export function TraceTitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("min-w-0 break-words font-medium", className)} {...props} />;
}

export function TraceDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 space-y-2 text-xs text-muted-foreground", className)} {...props} />;
}
