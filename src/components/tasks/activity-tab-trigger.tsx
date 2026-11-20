import type { ComponentProps } from "react";
import type { AgentStatus as Status, TaskComment } from "@/domain/task";
import { TabsTrigger } from "@/components/ui/tabs";
import { AgentStatus } from "./agent-status";

export function ActivityTabTrigger({ agentStatus, comments = [], children = "Activity", ...props }: ComponentProps<typeof TabsTrigger> & {
  agentStatus?: Status;
  comments?: TaskComment[];
}) {
  const status = comments.some((comment) => comment.feedbackStatus === "pending")
    ? "Waiting"
    : agentStatus === "Running" ? "Running" : null;

  return (
    <TabsTrigger aria-label={typeof children === "string" ? children : undefined} {...props}>
      {children}
      {status && <AgentStatus status={status} variant="icon" />}
    </TabsTrigger>
  );
}
