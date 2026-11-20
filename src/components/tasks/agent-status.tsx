import { LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { type AgentStatus as Status } from "@/domain/task";

const agentStatusColors: Record<Status, string> = {
  "Not started": "text-muted-foreground",
  Queued: "text-amber-600 dark:text-amber-400",
  Complete: "text-emerald-600 dark:text-emerald-400",
  Failed: "text-red-600 dark:text-red-400",
  Stopped: "text-amber-600 dark:text-amber-400",
  Interrupted: "text-amber-600 dark:text-amber-400",
  Running: "text-emerald-600 dark:text-emerald-400",
  Waiting: "text-amber-600 dark:text-amber-400",
  Paused: "text-amber-600 dark:text-amber-400",
  Review: "text-blue-600 dark:text-blue-400",
  Blocked: "text-red-600 dark:text-red-400",
};

const statusBackgrounds: Record<Status, string> = {
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

export function AgentStatus({
  status,
  className,
  variant = "default",
}: {
  status: Status;
  className?: string;
  variant?: "default" | "badge" | "icon";
}) {
  return (
    <span
      role={variant === "icon" ? "img" : undefined}
      aria-label={variant === "icon" ? (status === "Waiting" ? "Feedback required" : `Agent ${status.toLowerCase()}`) : undefined}
      title={variant === "icon" ? (status === "Waiting" ? "Feedback required" : `Agent ${status.toLowerCase()}`) : undefined}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        agentStatusColors[status],
        variant === "badge" && cn("min-h-8 w-fit rounded-xl px-2.5 py-1.5 font-medium", statusBackgrounds[status]),
        className,
      )}
    >
      {status === "Running" ? (
        <LoaderCircle
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : status === "Waiting" && variant === "icon" ? (
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className="size-2 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {variant !== "icon" && status}
    </span>
  );
}
