"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";
import type { TaskWorktree } from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notifyOperation } from "@/components/ui/toast";
import { TaskMetadataText } from "./task-id";

export function TaskBranch({ worktree, onRetry }: { worktree?: TaskWorktree | null; onRetry?: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  if (!worktree) return null;
  const state = worktree.status === "removed" ? "Worktree removed; local branch retained"
    : worktree.status === "error" ? "Worktree needs attention"
      : worktree.status === "creating" ? "Creating worktree" : "Worktree active";
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost-muted" size="xs" className="min-w-0 max-w-full" aria-label={`Branch details: ${worktree.branch}`}>
          <GitBranch size={12} aria-hidden="true" /><span className="truncate">{worktree.branch}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent size="wide" className="break-all">
        <TaskMetadataText>Local branch: {worktree.branch}</TaskMetadataText>
        <TaskMetadataText>Base: {worktree.baseBranch}</TaskMetadataText>
        <TaskMetadataText>Starting commit: {worktree.baseCommit}</TaskMetadataText>
        <TaskMetadataText>Latest recorded commit: {worktree.headCommit ?? "Not recorded"}</TaskMetadataText>
        <TaskMetadataText>Worktree: {worktree.path}</TaskMetadataText>
        <TaskMetadataText>{state}</TaskMetadataText>
      </PopoverContent>
    </Popover>
    <TaskMetadataText>{state}</TaskMetadataText>
    {worktree.error && <TaskMetadataText role="status">{worktree.error}</TaskMetadataText>}
    {worktree.status === "error" && onRetry && <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={async () => {
      setPending(true);
      try {
        await notifyOperation(onRetry, { loading: "Removing worktree…", success: "Worktree cleanup checked.", error: "Could not remove the worktree." });
      } catch { /* The toast reports the failure. */ }
      finally { setPending(false); }
    }}>Retry cleanup</Button>}
  </div>;
}
