"use client";

import Link from "next/link";
import { createContext, useContext, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

import { selectedWorkspaceId } from "@/lib/workspace-fetch";
import type { Workspace } from "@/domain/workspace";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
const Selection = createContext<{ workspace: Workspace; workspaces: Workspace[] } | null>(null);

const subscribe = () => () => {};

export function WorkspaceSelection({ workspaces, children }: { workspaces: Workspace[]; children: ReactNode }) {
  const workspaceId = useSyncExternalStore(subscribe, selectedWorkspaceId, () => undefined);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const invalid = workspaceId !== undefined && !workspace;
  if (invalid) return <main className="space-y-4 p-8"><p>This workspace is unavailable. Choose another workspace.</p>{workspaces.map((item) => <a className="block underline" key={item.id} href={`/?workspace=${encodeURIComponent(item.id)}`}>{item.name}</a>)}</main>;
  if (!workspace) return <main className="p-8" aria-busy="true">Loading workspace…</main>;
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
  return <div className="border-b p-2">
    <Label htmlFor="workspace-switcher" className="mb-1 block truncate text-xs text-muted-foreground">Workspace</Label>
    <NativeSelect id="workspace-switcher" className="max-w-full" value={selection.workspace.id} title={selection.workspace.path} onChange={(event) => {
      const url = new URL(window.location.href);
      url.searchParams.set("workspace", event.target.value);
      window.location.assign(url.href);
    }}>
      {selection.workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </NativeSelect>
    <p className="mt-1 hidden text-xs text-muted-foreground md:block">Switching clears unsaved drafts.</p>
  </div>;
}
