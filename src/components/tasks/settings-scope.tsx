"use client";

import { Globe, Folder } from "lucide-react";
import { useSelectedWorkspace } from "@/components/workspace-selection";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SettingsScope({ scope }: { scope: "global" | "workspace" }) {
  const workspace = useSelectedWorkspace();
  const global = scope === "global";
  const Icon = global ? Globe : Folder;
  return <Card variant="compact" elevation="flat" tone="muted">
    <CardHeader>
      <CardTitle><span className="flex items-center gap-2"><Icon className="size-4 shrink-0" aria-hidden="true" />
        {global ? "Global · All workspaces" : `Workspace · ${workspace?.name ?? "Current workspace"}`}
      </span></CardTitle>
      <CardDescription>{global ? "Changes apply to all workspaces." : "Changes apply only to this workspace."}</CardDescription>
    </CardHeader>
  </Card>;
}
