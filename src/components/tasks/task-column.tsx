"use client";

import type { ReactNode } from "react";
import { FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Status } from "@/domain/task";

export type TaskColumnProps = {
  status: Status;
  hasInstructions?: boolean;
  agentSelector?: ReactNode;
  onConfigure?: () => void;
  configureDisabled?: boolean;
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
  hasInstructions = false,
  agentSelector,
  onConfigure,
  configureDisabled = false,
  isEmpty = false,
  isDropTarget = false,
  canDrop = false,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: TaskColumnProps) {
  return (
    <section
      className={`group/column flex min-h-64 min-w-0 flex-col gap-3 rounded-lg px-1 py-3 outline-1 outline-dashed outline-offset-0 transition-[background-color,outline-color] duration-150 motion-reduce:transition-none ${isDropTarget ? "bg-muted/50 outline-border" : "outline-transparent"}`}
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
        <div className="group flex w-fit max-w-full items-center gap-1">
          <h2 className="min-w-0 text-lg font-semibold wrap-anywhere">{status}</h2>
          {hasInstructions && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} aria-label="Has Instructions" className="inline-flex shrink-0 cursor-help rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <FileText className="size-3.5" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Has Instructions</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onConfigure && <Button type="button" variant="ghost-muted" size="icon-xs" reveal="hover" disabled={configureDisabled} aria-label={`Edit ${status} column settings`} title="Column settings" onClick={onConfigure}><Pencil aria-hidden="true" /></Button>}
        </div>
        {agentSelector}
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
