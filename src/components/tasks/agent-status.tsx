import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentStatusColors, type AgentStatus as Status } from "./task";

export function AgentStatus({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", agentStatusColors[status], className)}>
      {status === "Running" ? (
        <LoaderCircle className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
      )}
      {status}
    </span>
  );
}
