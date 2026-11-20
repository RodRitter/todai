"use client";

import { GetStarted } from "./tasks/get-started";
import { WorkspaceArchive } from "./tasks/workspace-archive";
import Link from "next/link";
import { createContext, useContext, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

import { selectedWorkspaceId } from "@/lib/workspace-fetch";
import type { Workspace } from "@/domain/workspace";
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

export function WorkspaceLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const selection = useContext(Selection);
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query);
  if (selection) params.set("workspace", selection.workspace.id);
  return <Link {...props} href={`${path}${params.size ? `?${params}` : ""}`} />;
}

export function WorkspaceSwitcher() {
  const selection = useContext(Selection);
  if (!selection) return null;
  return <div className="border-b px-2 py-4 md:px-4">
    <Label htmlFor="workspace-switcher" variant="caption" className="mb-2">Workspace</Label>
    <Select value={selection.workspace.id} onValueChange={(workspaceId) => {
      const url = new URL(window.location.href);
      url.searchParams.set("workspace", workspaceId);
      window.location.assign(url.href);
    }}>
      <SelectTrigger id="workspace-switcher" className="w-full min-w-0" title={selection.workspace.path}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {selection.workspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
