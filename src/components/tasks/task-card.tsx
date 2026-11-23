"use client";

import { useRef } from "react";
import { MessageCircle } from "lucide-react";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskCardMetadata } from "./task-card-metadata";
import { AgentStatus } from "./agent-status";
import type { Task } from "@/domain/task";

export type TaskCardProps = {
  task: Task;
  isDragging?: boolean;
  onEdit: (task: Task, tab?: "detail" | "activity") => void;
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
        if (event.target !== event.currentTarget) return;
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
        <TaskCardMetadata task={task} />
        <CardTitle title={task.title}>{task.title}</CardTitle>
      </CardHeader>
      <CardFooter className="text-xs">
        <AgentStatus
          status={task.agentStatus}
          variant="badge"
        />
        {commentCount > 0 && (
          <Button
            type="button"
            variant="comment-badge"
            size="badge"
            aria-haspopup="dialog"
            onClick={(event) => {
              event.stopPropagation();
              if (!isDragging && !didDrag.current) onEdit(task, "activity");
            }}
            aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {commentCount}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
