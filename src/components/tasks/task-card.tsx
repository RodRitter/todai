"use client";

import { useRef } from "react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { AgentStatus } from "./agent-status";
import type { Task } from "@/domain/task";

export type TaskCardProps = {
  task: Task;
  isDragging?: boolean;
  onEdit: (task: Task) => void;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
};

export function TaskCard({
  task,
  isDragging = false,
  onEdit,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const didDrag = useRef(false);

  return (
    <Card
      variant="compact"
      data-task-id={task.id}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Edit ${task.title}, ${task.agentStatus}`}
      aria-haspopup="dialog"
      className={`cursor-pointer shadow-xs outline-none transition-[box-shadow,border-color,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] active:cursor-grabbing motion-reduce:transition-none ${isDragging ? "opacity-40" : "hover:border-ring/40 hover:shadow-sm"}`}
      onPointerDown={() => {
        didDrag.current = false;
      }}
      onClick={() => {
        if (!isDragging && !didDrag.current) onEdit(task);
      }}
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
          <CardDescription className="max-h-18 overflow-hidden">
            <Markdown compact>{task.description}</Markdown>
          </CardDescription>
        )}
      </CardHeader>
      <CardFooter className="pt-3 text-xs">
        <AgentStatus status={task.agentStatus} />
      </CardFooter>
    </Card>
  );
}
