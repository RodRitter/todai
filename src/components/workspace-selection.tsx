"use client";

import { GetStarted } from "./tasks/get-started";
import { WorkspaceArchive } from "./tasks/workspace-archive";
import Link from "next/link";
import { createContext, useId, useContext, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

import { selectedWorkspaceId, selectedBoardId } from "@/lib/workspace-fetch";
import type { Workspace } from "@/domain/workspace";
import type { Board } from "@/domain/task";
import { notifyOperation } from "@/components/ui/toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const Selection = createContext<{ workspace: Workspace; workspaces: Workspace[] } | null>(null);

const subscribe = () => () => {};

export function WorkspaceSelection({ workspaces, children }: { workspaces: Workspace[]; children: ReactNode }) {
  const workspaceId = useSyncExternalStore(subscribe, selectedWorkspaceId, () => undefined);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const invalid = workspaceId !== undefined && !workspace;
  if (!workspaces.length) return <GetStarted />;
  if (invalid) return <main className="space-y-4 p-4 md:p-8"><p>This workspace is unavailable. Choose another workspace.</p>{workspaces.map((item) => <a className="block underline" key={item.id} href={`/?workspace=${encodeURIComponent(item.id)}`}>{item.name}</a>)}<WorkspaceArchive allowArchive={false} /></main>;
  if (!workspace) return <main className="p-4 md:p-8" aria-busy="true">Loading workspace…</main>;
  return <Selection.Provider value={{ workspace, workspaces }}>{children}</Selection.Provider>;
}

export function useSelectedWorkspace() {
  return useContext(Selection)?.workspace;
}

export function WorkspaceLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const selection = useContext(Selection);
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query);
  const boardId = selectedBoardId();
  if (boardId && !params.has("board")) params.set("board", boardId);
  if (selection) params.set("workspace", selection.workspace.id);
  return <Link {...props} href={`${path}${params.size ? `?${params}` : ""}`} />;
}

export function WorkspaceSwitcher({ layout = "shell", disabled = false }: { layout?: "shell" | "settings"; disabled?: boolean }) {
  const id = useId();
  const selection = useContext(Selection);
  const [switching, setSwitching] = useState(false);
  if (!selection) return null;
  return <div className={layout === "shell" ? "border-b px-2 py-4 md:px-4" : "min-w-0"}>
    <Label htmlFor={id} variant="caption" className="mb-2">Workspace</Label>
    <Select disabled={disabled || switching} value={selection.workspace.id} onValueChange={async (workspaceId) => {
      setSwitching(true);
      try {
        const board = await notifyOperation(async () => {
          const response = await fetch("/api/boards", {
            headers: { "X-Todai-Workspace": workspaceId },
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Could not load boards.");
          const boards: Board[] = await response.json();
          if (!boards[0]) throw new Error("The workspace has no boards.");
          return boards[0];
        }, {
          loading: "Opening workspace…",
          success: "Workspace ready.",
          error: "Could not open the workspace. Try again.",
        });
        const url = new URL(window.location.href);
        url.searchParams.set("workspace", workspaceId);
        url.searchParams.set("board", board.id);
        url.searchParams.delete("settingsBoard");
        window.location.assign(url.href);
      } catch {
        // The notification shows the failure. Keep the current workspace.
        setSwitching(false);
      }
    }}>
      <SelectTrigger id={id} className="w-full min-w-0" title={selection.workspace.path}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {selection.workspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
