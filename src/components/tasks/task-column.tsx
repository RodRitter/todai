"use client";

import type { ReactNode } from "react";
import type { Status } from "./task";

export type TaskColumnProps = {
  status: Status;
  isEmpty?: boolean;
  isDropTarget?: boolean;
  canDrop?: boolean;
  onDragOver?: () => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  children?: ReactNode;
};

export function TaskColumn({ status, isEmpty = false, isDropTarget = false, canDrop = false, onDragOver, onDragLeave, onDrop, children }: TaskColumnProps) {
  return (
    <section
      className={`min-h-64 space-y-4 rounded-lg p-3 outline-1 outline-dashed outline-offset-0 transition-[background-color,outline-color] duration-150 motion-reduce:transition-none ${isDropTarget ? "bg-muted/50 outline-border" : "outline-transparent"}`}
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
      <h2 className="text-lg font-semibold">{status}</h2>
      {isEmpty ? <div className="min-h-36 rounded-lg border border-dashed p-4" aria-hidden="true" /> : children}
    </section>
  );
}
