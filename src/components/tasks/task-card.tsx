"use client";

import { useRef } from "react";
import { MessageCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";

const statusBackgrounds: Record<Task["agentStatus"], string> = {
  "Not started": "bg-muted",
  Queued: "bg-amber-50 dark:bg-amber-950/40",
  Complete: "bg-emerald-50 dark:bg-emerald-950/40",
  Failed: "bg-red-50 dark:bg-red-950/40",
  Stopped: "bg-amber-50 dark:bg-amber-950/40",
  Interrupted: "bg-amber-50 dark:bg-amber-950/40",
  Running: "bg-emerald-50 dark:bg-emerald-950/40",
  Waiting: "bg-amber-50 dark:bg-amber-950/40",
  Paused: "bg-amber-50 dark:bg-amber-950/40",
  Review: "bg-blue-50 dark:bg-blue-950/40",
  Blocked: "bg-red-50 dark:bg-red-950/40",
};

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
      draggable={!task.workflowActive}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${task.title}, ${task.agentStatus}`}
      aria-haspopup="dialog"
      className={cn(
        "relative cursor-pointer overflow-hidden outline-none transition-[box-shadow,border-color,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] active:cursor-grabbing motion-reduce:transition-none",
        needsAttention && "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-red-500",
        isDragging ? "opacity-40" : "hover:border-ring/30 hover:shadow-md",
      )}
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
        <CardTitle>{task.title}</CardTitle>
        {task.description && (
          <CardDescription className="line-clamp-2 max-h-12">
            <Markdown compact>{task.description}</Markdown>
          </CardDescription>
        )}
      </CardHeader>
      <CardFooter className="text-xs">
        <AgentStatus
          status={task.agentStatus}
          className={cn("min-h-8 rounded-xl px-2.5 py-1.5 font-medium", statusBackgrounds[task.agentStatus])}
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
