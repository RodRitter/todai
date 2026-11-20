"use client";

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, name, ...props }: React.ComponentProps<"div"> & { name?: string }) {
  return (
    <div
      data-slot="message-avatar"
      aria-hidden="true"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center self-start overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
      {...props}
    >{name ? name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() : props.children}</div>
  )
}

function MessageContent({ className, connected = false, ...props }: React.ComponentProps<"div"> & { connected?: boolean }) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:[&>[data-slot]:not([data-slot=message-replies])]:self-end",
        connected && "relative grid grid-cols-1 before:absolute before:-left-6 before:row-start-1 before:row-end-3 before:top-10 before:-bottom-2.5 before:border-l before:border-border",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex min-h-8 max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
}

export function MessageReplies({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "compact" }) {
  return <div data-slot="message-replies" className={cn(
    "min-w-0 self-stretch border-l border-border text-sm",
    variant === "compact" ? "mt-3 space-y-3 pl-3" : "mt-4 ml-3 space-y-4 pl-4 sm:ml-6",
    className,
  )} {...props} />;
}

export function MessageReply({ label, avatarName = label, actions, children, className, ...props }: React.ComponentProps<"div"> & { label: string; avatarName?: string; actions?: React.ReactNode }) {
  return <div data-slot="message-reply" className={cn("group/reply relative flex min-w-0 gap-2 pb-5 last:pb-0 before:absolute before:left-4 before:top-10 before:bottom-1 before:border-l before:border-border last:before:hidden", className)} {...props}>
    <MessageAvatar name={avatarName} />
    <MessageContent>
      <MessageHeader><MessageAuthor>{label}</MessageAuthor>{actions}</MessageHeader>
      {children}
    </MessageContent>
  </div>;
}

export function MessageAuthor({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("min-w-0 text-sm font-semibold text-foreground wrap-anywhere", className)} {...props} />;
}

export function MessageThread({ count, open, onOpenChange, children, className, ...props }: React.ComponentProps<"div"> & {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const label = count ? `${count} ${count === 1 ? "reply" : "replies"}` : "Reply thread";
  return <Collapsible open={open} onOpenChange={onOpenChange} asChild>
    <div data-slot="message-replies" className={cn("relative min-w-0 self-stretch", className)} {...props}>
      <div className="relative pb-3 before:absolute before:-left-6 before:-top-2.5 before:bottom-0 before:border-l before:border-border">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost-muted" size="sm"
            aria-label={`${open ? "Collapse" : "Expand"} ${label.toLowerCase()}`}>
            <span>{label}</span>
            <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent forceMount hidden={!open} className="relative before:pointer-events-none before:absolute before:-left-6 before:top-0 before:h-4 before:w-6 before:rounded-bl-xl before:border-b before:border-l before:border-border">
        {children}
      </CollapsibleContent>
    </div>
  </Collapsible>;
}
