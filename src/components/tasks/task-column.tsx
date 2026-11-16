"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import type { Status } from "./task";

export type TaskColumnProps = {
  status: Status;
  agentName?: string;
  onConfigureAgent?: () => void;
  isEmpty?: boolean;
  isDropTarget?: boolean;
  canDrop?: boolean;
  onDragOver?: () => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  children?: ReactNode;
};

export function TaskColumn({ status, agentName, onConfigureAgent, isEmpty = false, isDropTarget = false, canDrop = false, onDragOver, onDragLeave, onDrop, children }: TaskColumnProps) {
  return (
    <section
      className={`flex min-h-64 flex-col gap-4 rounded-lg p-3 outline-1 outline-dashed outline-offset-0 transition-[background-color,outline-color] duration-150 motion-reduce:transition-none ${isDropTarget ? "bg-muted/50 outline-border" : "outline-transparent"}`}
      aria-label={status}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver?.();
      }}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
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
          <h2 className="text-lg font-semibold">{status}</h2>
          {onConfigureAgent && <Button variant="ghost" size="icon" aria-label={`Configure agent for ${status}`} onClick={onConfigureAgent}><Settings2 /></Button>}
        </div>
        {onConfigureAgent && <p className="text-sm text-muted-foreground break-words">{agentName ?? 'No agent configured'}</p>}
      </div>
      {isEmpty ? <div className="min-h-36 flex-1 rounded-lg border border-dashed p-4" aria-hidden="true" /> : children}
    </section>
  );
}
