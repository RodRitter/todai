"use client";

import { useState } from "react";
import { Copy, GitBranch } from "lucide-react";
import type { TaskWorktree } from "@/domain/task";
import { VSCodeIcon } from "@/components/ui/vscode-icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const compactState = worktree.status === "removed" ? "Removed"
    : worktree.status === "error" ? "Needs attention"
      : worktree.status === "creating" ? "Creating…" : "Active";
  return <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost-muted" size="xs" weight="normal" className="min-w-0 max-w-full sm:max-w-64" aria-label={`Branch details: ${worktree.branch}`}>
          <GitBranch size={12} aria-hidden="true" /><span className="truncate">{worktree.branch}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent size="wide" className="break-all">
        <TaskMetadataText weight="normal">Local branch: {worktree.branch}</TaskMetadataText>
        <TaskMetadataText weight="normal">Base: {worktree.baseBranch}</TaskMetadataText>
        <TaskMetadataText weight="normal">Starting commit: {worktree.baseCommit}</TaskMetadataText>
        <TaskMetadataText weight="normal">Latest recorded commit: {worktree.headCommit ?? "Not recorded"}</TaskMetadataText>
        <TaskMetadataText weight="normal">Worktree: {worktree.path}</TaskMetadataText>
        <TaskMetadataText weight="normal">{state}</TaskMetadataText>
        {worktree.error && <TaskMetadataText weight="normal" role="status">{worktree.error}</TaskMetadataText>}
      </PopoverContent>
    </Popover>
    <div className="flex shrink-0 items-center gap-1">
      <TaskMetadataText weight="normal" variant="badge" role="status" aria-label={state}>{compactState}</TaskMetadataText>
      {worktree.status === "active" && <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost-muted" size="icon-xs">
              <a aria-label="Open in VS Code" href={`vscode://file/${worktree.path.split("/").map(encodeURIComponent).join("/").replace(/^\//, "")}/`}>
                <VSCodeIcon aria-hidden="true" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in VS Code</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost-muted" size="icon-xs" aria-label="Copy path" disabled={pending} onClick={async () => {
              setPending(true);
              try {
                await notifyOperation(() => navigator.clipboard.writeText(worktree.path), {
                  loading: "Copying worktree path…", success: "Worktree path copied.", error: "Could not copy the worktree path.",
                });
              } catch { /* The toast reports the failure. */ }
              finally { setPending(false); }
            }}><Copy aria-hidden="true" /></Button>
          </TooltipTrigger>
          <TooltipContent>Copy worktree path</TooltipContent>
        </Tooltip>
      </TooltipProvider>}
      {worktree.status === "error" && onRetry && <Button type="button" variant="ghost-muted" size="xs" weight="normal" disabled={pending} onClick={async () => {
        setPending(true);
        try {
          await notifyOperation(onRetry, { loading: "Removing worktree…", success: "Worktree cleanup checked.", error: "Could not remove the worktree." });
        } catch { /* The toast reports the failure. */ }
        finally { setPending(false); }
      }}>Retry cleanup</Button>}
    </div>
  </div>;
}
