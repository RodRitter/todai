"use client";

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDown, LoaderCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function isReplyInputActive(document: Document) {
  return !!document.activeElement?.closest('[data-slot="message-reply-composer"]');
}

function useMessageAttention(attention: boolean) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!attention) return;
    const frame = requestAnimationFrame(() => {
      if (ref.current && isReplyInputActive(ref.current.ownerDocument)) return;
      ref.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [attention]);
  return ref;
}

function MessageGroup({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "comment" | "reply" }) {
  return (
    <div
      data-slot="message-group"
      data-variant={variant}
      className={cn("flex min-w-0 flex-col gap-2", variant === "comment" && "rounded-2xl bg-transparent text-card-foreground", variant === "reply" && "py-3 first:pt-0 last:pb-0", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  attention = false,
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end"; attention?: boolean }) {
  const attentionRef = useMessageAttention(attention);
  return (
    <div
      ref={attentionRef}
      data-attention={attention || undefined}
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

export function MessageBubbleRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-bubble-row" className={cn(
    "flex w-full min-w-0 items-center justify-end gap-2 pl-10",
    className,
  )} {...props} />;
}

function MessageHeader({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "disclosure" | "reply" }) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex min-h-8 max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground",
        variant !== "default" && "relative min-h-0 gap-y-1 px-2 py-1.5 text-inherit",
        variant === "reply" && "gap-x-1.5 px-1.5 py-0.5 [&>[data-slot=message-author]]:text-xs",
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

export function MessageDisclosure({ open, onOpenChange, label, createdAt, actions, status, composer, replyCount, attention = false, nested = false, children, ...props }: React.ComponentProps<"div"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  createdAt?: string;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  composer?: React.ReactNode;
  replyCount: number;
  attention?: boolean;
  nested?: boolean;
}) {
  const attentionRef = useMessageAttention(attention);
  const trigger = <CollapsibleTrigger asChild>
    <button type="button" aria-label={`${open ? "Collapse" : "Expand"} comment by ${label}`}
      className="absolute inset-0 z-0 cursor-pointer rounded-lg outline-none transition-colors hover:bg-background/10 dark:hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-background dark:focus-visible:ring-ring motion-reduce:transition-none" />
  </CollapsibleTrigger>;
  return <Collapsible open={open} onOpenChange={onOpenChange} asChild>
    <MessageGroup ref={attentionRef} variant={nested ? "reply" : "comment"} data-attention={attention || undefined} {...props}>
      <div data-slot={nested ? "message-reply" : "message"}>
        <Card variant="comment-header" elevation="flat" tone="contrast">
          <MessageHeader variant={nested ? "reply" : "disclosure"}>
            {createdAt ? <TooltipProvider><Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent><time dateTime={createdAt}>{new Date(createdAt).toLocaleString()}</time></TooltipContent></Tooltip></TooltipProvider> : trigger}
            <span data-slot="message-author" className="pointer-events-none relative min-w-0 text-sm font-semibold wrap-anywhere">{label}</span>
            {actions && <div className="pointer-events-none relative flex flex-wrap items-center gap-1 [&>button]:pointer-events-auto">{actions}</div>}
            <span className="pointer-events-none relative ml-auto flex flex-wrap items-center justify-end gap-2">
              {!open && !nested && <span data-slot="message-reply-summary">{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>}
              {status}
              <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />
            </span>
          </MessageHeader>
        </Card>
      </div>
      <CollapsibleContent forceMount>
        <div data-slot="message-content" className="min-w-0 space-y-3 p-2 text-sm">
          <div data-slot="message-comments" className="min-w-0 space-y-3">
            {children}
          </div>
          {composer}
        </div>
      </CollapsibleContent>
    </MessageGroup>
  </Collapsible>;
}

export function MessageReplyComposer({ className, connected = false, ...props }: React.ComponentProps<"div"> & { connected?: boolean }) {
  return <div data-slot="message-reply-composer" className={cn(
    "relative min-w-0",
    connected && "before:pointer-events-none before:absolute before:-top-3 before:-left-2 before:h-7 before:w-2 before:rounded-bl-lg before:border-b before:border-l before:border-border",
    className,
  )} {...props} />;
}

export function MessageAuthor({ className, createdAt, ...props }: React.ComponentProps<"span"> & { createdAt?: string }) {
  const author = <span tabIndex={createdAt ? 0 : undefined} className={cn("min-w-0 rounded-sm text-sm font-semibold text-foreground wrap-anywhere focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />;
  if (!createdAt) return author;
  return <TooltipProvider><Tooltip>
    <TooltipTrigger asChild>{author}</TooltipTrigger>
    <TooltipContent><time dateTime={createdAt}>{new Date(createdAt).toLocaleString()}</time></TooltipContent>
  </Tooltip></TooltipProvider>;
}

export function MessageThread({ children, className, gutter = true, ...props }: React.ComponentProps<"div"> & { gutter?: boolean }) {
  return <div data-slot="message-replies" className={cn(
    "relative min-w-0",
    gutter && "before:pointer-events-none before:absolute before:top-4 before:bottom-0 before:-left-2 before:w-2 before:rounded-tl-lg before:border-t before:border-l before:border-border",
    gutter && "[&>[data-variant=reply]]:relative [&>[data-variant=reply]:not(:first-child)]:before:pointer-events-none [&>[data-variant=reply]:not(:first-child)]:before:absolute [&>[data-variant=reply]:not(:first-child)]:before:top-7 [&>[data-variant=reply]:not(:first-child)]:before:-left-2 [&>[data-variant=reply]:not(:first-child)]:before:h-px [&>[data-variant=reply]:not(:first-child)]:before:w-2 [&>[data-variant=reply]:not(:first-child)]:before:bg-border",
    className,
  )} {...props}>{children}</div>;
}

export function MessageAgentStatus({ status }: { status: "Running" | "Queued" }) {
  return <Message role="status"><MessageContent>
    <MessageHeader><LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none" />{status === "Queued" ? "The agent is queued to start." : "The agent is working…"}</MessageHeader>
  </MessageContent></Message>;
}
