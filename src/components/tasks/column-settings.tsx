"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsSections } from "./settings-sections";
import { WorkspaceSettingsTab } from "./workspace-settings-tab";
import { CreateWorkspace } from "./create-workspace";
import { WorkspaceArchive } from "./workspace-archive";
import { ColumnEditor } from "./column-editor";

export function ColumnSettings({
  boardSettings,
  initialColumns,
  initialTaskCounts = {},
  create,
  reorder,
  rename,
  remove,
  workspaceSettings,
  generalSettings,
  executorSettings,
  transferSettings,
  workspaceSection,
  onWorkspaceSectionChange,
  tab,
  onTabChange,
}: {
  boardSettings?: ReactNode;
  tab?: "general" | "workspaces" | "board" | "executors" | "transfer";
  executorSettings?: ReactNode;
  transferSettings?: ReactNode;
  workspaceSection?: string;
  onWorkspaceSectionChange?: (value: string) => void;
  onTabChange?: (value: string) => void;
  workspaceSettings?: ReactNode;
  generalSettings?: ReactNode;
  initialColumns: string[];
  initialTaskCounts?: Record<string, number>;
  create: (name: string) => Promise<string[]>;
  reorder: (columns: string[]) => Promise<string[]>;
  rename: (column: string, name: string) => Promise<string[]>;
  remove: (column: string) => Promise<string[]>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AppShell screen="settings">
      <Tabs defaultValue="general" value={tab && tab !== "general" ? "workspaces" : tab} onValueChange={onTabChange} asChild>
        <main className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
          <h1 className="sr-only">Settings</h1>
          <TabsList layout="wrap" aria-label="Settings sections">
            <TabsTrigger value="general">Global</TabsTrigger>
            <TabsTrigger value="workspaces">Workspace</TabsTrigger>
          </TabsList>
          <TabsContent value="general" forceMount className="space-y-8">
            <SettingsSections label="Global categories" disabled={busy} sections={[
              { id: "identity", label: "Identity", content: generalSettings },
              { id: "new", label: "New workspace", content: <CreateWorkspace onBusyChange={setBusy} /> },
              { id: "archived", label: "Archived workspaces", content: <WorkspaceArchive allowArchive={false} onBusyChange={setBusy} /> },
            ]} />
          </TabsContent>
          <TabsContent value="workspaces" forceMount>
            <WorkspaceSettingsTab directorySettings={workspaceSettings} transferSettings={transferSettings} executorSettings={executorSettings}
              section={workspaceSection} onSectionChange={onWorkspaceSectionChange}
              initialSection={tab === "board" ? "boards" : tab === "executors" || tab === "transfer" ? tab : undefined}
              boardSettings={boardSettings ?? <ColumnEditor initialColumns={initialColumns} initialTaskCounts={initialTaskCounts}
                create={create} reorder={reorder} rename={rename} remove={remove} />} />
          </TabsContent>
        </main>
      </Tabs>

    </AppShell>
  );
}
