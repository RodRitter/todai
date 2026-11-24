"use client";

import { useState } from "react";
import { Copy, Ellipsis, GitBranch } from "lucide-react";
import type { TaskWorktree } from "@/domain/task";
import { VSCodeIcon } from "@/components/ui/vscode-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const copy = async (value: string, kind: "Branch name" | "Worktree path") => {
    setPending(true);
    try {
      await notifyOperation(() => navigator.clipboard.writeText(value), {
        loading: `Copying ${kind.toLowerCase()}…`, success: `${kind} copied.`, error: `Could not copy the ${kind.toLowerCase()}.`,
      });
    } catch { /* The toast reports the failure. */ }
    finally { setPending(false); }
  };
  return <div className="flex min-w-0 max-w-full items-center gap-1">
    <Button type="button" variant="ghost-muted" size="xs" weight="normal" className="min-w-0 max-w-full flex-1 sm:max-w-64" aria-label={`Copy branch name: ${worktree.branch}`} title={worktree.branch} disabled={pending} onClick={() => copy(worktree.branch, "Branch name")}>
      <GitBranch size={12} aria-hidden="true" /><span className="truncate">{worktree.branch}</span>
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost-muted" size="icon-xs" aria-label="Branch and worktree actions" title="Branch and worktree actions"><Ellipsis aria-hidden="true" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-80">
        <DropdownMenuLabel>
          <TaskMetadataText weight="normal" variant="badge" role="status" aria-label={state}>{compactState}</TaskMetadataText>
          {worktree.error && <TaskMetadataText weight="normal">{worktree.error}</TaskMetadataText>}
        </DropdownMenuLabel>
        <DropdownMenuItem disabled={pending || worktree.status !== "active"} onSelect={() => { void copy(worktree.path, "Worktree path"); }}>
          <Copy aria-hidden="true" />Copy worktree path
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={worktree.status !== "active"}>
          <a href={worktree.status === "active" ? `vscode://file/${worktree.path.split("/").map(encodeURIComponent).join("/").replace(/^\//, "")}/` : undefined}>
            <VSCodeIcon aria-hidden="true" />Open worktree in VS Code
          </a>
        </DropdownMenuItem>
        {worktree.status === "error" && onRetry && <DropdownMenuItem disabled={pending} onSelect={async () => {
          setPending(true);
          try {
            await notifyOperation(onRetry, { loading: "Removing worktree…", success: "Worktree cleanup checked.", error: "Could not remove the worktree." });
          } catch { /* The toast reports the failure. */ }
          finally { setPending(false); }
        }}>Retry cleanup</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
