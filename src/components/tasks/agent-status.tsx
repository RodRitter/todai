import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type AgentStatus as Status } from "@/domain/task";

const agentStatusColors: Record<Status, string> = {
  "Not started": "text-muted-foreground",
  Queued: "text-amber-600 dark:text-amber-400",
  Complete: "text-emerald-600 dark:text-emerald-400",
  Failed: "text-red-600 dark:text-red-400",
  Interrupted: "text-amber-600 dark:text-amber-400",
  Running: "text-emerald-600 dark:text-emerald-400",
  Waiting: "text-amber-600 dark:text-amber-400",
  Paused: "text-amber-600 dark:text-amber-400",
  Review: "text-blue-600 dark:text-blue-400",
  Blocked: "text-red-600 dark:text-red-400",
};

export function AgentStatus({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs",
        agentStatusColors[status],
        className,
      )}
    >
      {status === "Running" ? (
        <LoaderCircle
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <span
          className="size-2 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {status}
    </span>
  );
}
