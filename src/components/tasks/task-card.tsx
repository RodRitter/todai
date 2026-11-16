"use client";

import { useRef } from "react";
import { Bot } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentStatus } from "./agent-status";
import type { Task } from "./task";

export type TaskCardProps = {
  task: Task;
  isDragging?: boolean;
  onEdit: (task: Task) => void;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
};

export function TaskCard({ task, isDragging = false, onEdit, onDragStart, onDragEnd }: TaskCardProps) {
  const didDrag = useRef(false);

  return (
    <Card
      variant="compact"
      data-task-id={task.id}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Edit ${task.title}, ${task.agentStatus}, ${task.owner}`}
      aria-haspopup="dialog"
      className={`cursor-pointer outline-none transition-[box-shadow,border-color,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] active:cursor-grabbing motion-reduce:transition-none ${isDragging ? "opacity-40" : "hover:border-ring/40 hover:shadow-md"}`}
      onPointerDown={() => { didDrag.current = false; }}
      onClick={() => { if (!isDragging && !didDrag.current) onEdit(task); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(task);
        }
      }}
      onDragStart={(event) => {
        didDrag.current = true;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart?.(task);
      }}
      onDragEnd={onDragEnd}
    >
      <CardHeader>
        <CardTitle className="break-words">{task.title}</CardTitle>
        {task.description && (
          <CardDescription className="line-clamp-3 break-words whitespace-pre-wrap">
            {task.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardFooter className="grid grid-cols-2 gap-2 pt-3 text-xs">
        <AgentStatus status={task.agentStatus} />
        <span className="text-muted-foreground flex min-w-0 items-center justify-end gap-1.5">
          <Bot className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{task.owner}</span>
        </span>
      </CardFooter>
    </Card>
  );
}
