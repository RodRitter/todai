"use client";

import { useRef } from "react";
import { MessageCircle } from "lucide-react";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const needsAttention = task.agentStatus === "Blocked" || task.agentStatus === "Failed";
  const commentCount = task.comments?.length ?? 0;

  return (
    <Card
      variant="task"
      data-task-id={task.id}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Edit ${task.title}, ${task.agentStatus}`}
      aria-haspopup="dialog"
      interactive
      attention={needsAttention}
      dragging={isDragging}
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
        <CardTitle title={task.title}>{task.title}</CardTitle>
      </CardHeader>
      <CardFooter className="text-xs">
        <AgentStatus
          status={task.agentStatus}
          variant="badge"
        />
        {commentCount > 0 && (
          <span
            className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-muted px-2.5 py-1.5 text-muted-foreground"
            aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {commentCount}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
