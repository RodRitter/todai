"use client";

import type { ReactNode } from "react";
import type { Status } from "@/domain/task";

export type TaskColumnProps = {
  status: Status;
  agentSelector?: ReactNode;
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
  agentSelector,
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
        <h2 className="min-w-0 text-lg font-semibold wrap-anywhere">
          {status}
        </h2>
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
