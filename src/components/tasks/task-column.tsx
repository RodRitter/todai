"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Settings2 } from "lucide-react";
import type { Status } from "@/domain/task";

export type TaskColumnProps = {
  status: Status;
  agentName?: string;
  onEditAgent?: () => void;
  onConfigureAgent?: () => void;
  isEmpty?: boolean;
  isDropTarget?: boolean;
  canDrop?: boolean;
  onDragOver?: () => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  children?: ReactNode;
};

export function TaskColumn({
  status,
  agentName,
  onEditAgent,
  onConfigureAgent,
  isEmpty = false,
  isDropTarget = false,
  canDrop = false,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: TaskColumnProps) {
  const AgentBadge = onEditAgent ? "button" : "span";
  return (
    <section
      className={`group/column flex min-h-64 min-w-0 flex-col gap-4 rounded-lg p-3 outline-1 outline-dashed outline-offset-0 transition-[background-color,outline-color] duration-150 motion-reduce:transition-none ${isDropTarget ? "bg-muted/50 outline-border" : "outline-transparent"}`}
      aria-label={status}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver?.();
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          onDragLeave?.();
        }
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDrop?.();
      }}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 text-lg font-semibold wrap-anywhere">
            {status}
          </h2>
          {onConfigureAgent && (
            <Button
              className="[@media(hover:hover)]:opacity-0 group-hover/column:opacity-100 group-focus-within/column:opacity-100 focus-visible:opacity-100 transition-opacity"
              variant="ghost"
              size="icon"
              aria-label={`Configure agent for ${status}`}
              onClick={onConfigureAgent}
            >
              <Settings2 />
            </Button>
          )}
        </div>
        {agentName ? (
          <AgentBadge
            type={onEditAgent ? "button" : undefined}
            onClick={onEditAgent}
            aria-haspopup={onEditAgent ? "dialog" : undefined}
            title={onEditAgent ? `Edit ${agentName}` : undefined}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground ${onEditAgent ? "cursor-pointer transition-colors hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : ""}`}
            aria-label={`Assigned agent: ${agentName}`}
          >
            <Bot className="size-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{agentName}</span>
          </AgentBadge>
        ) : (
          onConfigureAgent && (
            <p className="text-sm text-muted-foreground">No agent assigned</p>
          )
        )}
      </div>
      {isEmpty ? (
        <div
          className="min-h-36 flex-1 rounded-lg border border-dashed p-4"
          aria-hidden="true"
        />
      ) : (
        children
      )}
    </section>
  );
}
