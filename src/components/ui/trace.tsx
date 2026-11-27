"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible"
import { ChevronRight } from "lucide-react"
import { ScrollArea } from "./scroll-area"
import { formatRunDuration } from "@/domain/run-duration"

export const runningTraceStepLimit = 5;

function Trace({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="trace"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2 *:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:rounded-md *:has-[>[data-slot=trace-line]]:text-left *:has-[>[data-slot=trace-line]]:outline-none *:has-[>[data-slot=trace-line]]:focus-visible:ring-3 *:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/50",
        className
      )}
      {...props}
    />
  )
}

function TraceLine({
  className,
  status,
  ...props
}: React.ComponentProps<"span"> & {
  status?: "running" | "error" | "pending" | "complete"
}) {
  return (
    <span
      data-slot="trace-line"
      data-status={status === "complete" ? undefined : status}
      className={cn(
        "flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-foreground data-[status=error]:text-destructive data-[status=error]:in-[a:hover,button:hover]:text-destructive data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:shimmer",
        className
      )}
      {...props}
    />
  )
}

function TraceIcon({ className, motion = "none", ...props }: React.ComponentProps<"span"> & { motion?: "none" | "spin" }) {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [[data-slot=trace-title]~&]:-ml-1",
        motion === "spin" && "animate-spin motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

function TraceTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-title"
      className={cn("min-w-0 truncate motion-reduce:shimmer-none", className)}
      {...props}
    />
  )
}

function TraceDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="trace-description" className={cn("min-w-0 space-y-2 text-xs text-muted-foreground", className)} {...props} />;
}

function TraceCollapsible({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Collapsible>, "open"> &
  (
    | { open?: undefined }
    | {
        open: boolean
        onOpenChange: NonNullable<
          React.ComponentProps<typeof Collapsible>["onOpenChange"]
        >
      }
  )) {
  return (
    <Collapsible
      data-slot="trace-collapsible"
      className={cn("flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  )
}

function TraceCollapsibleTrigger({
  className,
  children,
  size,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & { size?: "xs" | "sm" }) {
  return (
    <CollapsibleTrigger
      data-slot="trace-collapsible-trigger"
      className={cn(
        "group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 has-[[data-status=error]]:text-destructive",
        size === "xs" && "text-xs",
        className
      )}
      {...props}
    >
      {children}
      <TraceIcon className="transition-transform group-aria-expanded/trace-collapsible-trigger:rotate-90">
        <ChevronRight />
      </TraceIcon>
    </CollapsibleTrigger>
  )
}

function TraceCollapsibleContent({
  className,
  children,
  keepMounted = false,
  ...props
}: React.ComponentProps<typeof CollapsibleContent> & { keepMounted?: boolean }) {
  return (
    <CollapsibleContent
      data-slot="trace-collapsible-content"
      forceMount={keepMounted ? true : undefined}
      className="min-w-0"
      {...props}
    >
      <div
        data-slot="trace-collapsible-content-inner"
        className={cn(
          "mt-2 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 border-l pr-1 pl-4 leading-relaxed wrap-break-word text-muted-foreground",
          className
        )}
      >
        {children}
      </div>
    </CollapsibleContent>
  )
}

export {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
}

export function TraceOutput({ children }: { children: string }) {
  return <ScrollArea orientation="both" variant="code" className="max-h-80">
    <pre className="p-3 font-mono text-xs whitespace-pre"><code>{children}</code></pre>
  </ScrollArea>;
}

export function TraceCode({ children }: { children: string }) {
  return <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.875em]">{children}</code>;
}

export function TraceDuration({ seconds, running }: { seconds: number; running: boolean }) {
  const label = formatRunDuration(seconds);
  return <time data-slot="trace-duration" dateTime={`PT${seconds}S`} aria-label={`${running ? "Elapsed time" : "Duration"}: ${label}`}
    className="shrink-0 text-xs text-muted-foreground/70 tabular-nums" suppressHydrationWarning>{label}</time>;
}
