"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsScope } from "./settings-scope";
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
  transferSettings,
  generalSettings,
  executorSettings,
  tab,
  onTabChange,
}: {
  boardSettings?: ReactNode;
  tab?: "general" | "workspaces" | "board" | "executors" | "transfer";
  executorSettings?: ReactNode;
  onTabChange?: (value: string) => void;
  workspaceSettings?: ReactNode;
  transferSettings?: ReactNode;
  generalSettings?: ReactNode;
  initialColumns: string[];
  initialTaskCounts?: Record<string, number>;
  create: (name: string) => Promise<string[]>;
  reorder: (columns: string[]) => Promise<string[]>;
  rename: (column: string, name: string) => Promise<string[]>;
  remove: (column: string) => Promise<string[]>;
}) {
  return (
    <AppShell screen="settings">
      <Tabs defaultValue="general" value={tab} onValueChange={onTabChange} asChild>
        <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
          <header className="space-y-2">
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Click a value to edit it. Leave the field to save, or press Enter in single-line fields. Escape cancels edits. Switches and selections save immediately.</p>
          </header>
          <TabsList layout="wrap" aria-label="Settings sections">
            <TabsTrigger value="general">Global</TabsTrigger>
            {workspaceSettings && <TabsTrigger value="workspaces">Workspace</TabsTrigger>}
            <TabsTrigger value="board">Board</TabsTrigger>
            {transferSettings && <TabsTrigger value="transfer">Import and export</TabsTrigger>}
            {executorSettings && <TabsTrigger value="executors">Executors</TabsTrigger>}
          </TabsList>
          <TabsContent value="general" forceMount className="space-y-8">
            <SettingsScope scope="global" />
            {generalSettings}
          </TabsContent>
          {workspaceSettings && <TabsContent value="workspaces" forceMount className="space-y-8"><SettingsScope scope="workspace" />{workspaceSettings}</TabsContent>}
          {transferSettings && <TabsContent value="transfer" forceMount className="space-y-8"><SettingsScope scope="workspace" />{transferSettings}</TabsContent>}
          {executorSettings && <TabsContent value="executors" forceMount className="space-y-8"><SettingsScope scope="workspace" />{executorSettings}</TabsContent>}
          <TabsContent value="board" forceMount className="space-y-8">
            <SettingsScope scope="workspace" />
            {boardSettings ?? <ColumnEditor initialColumns={initialColumns} initialTaskCounts={initialTaskCounts}
              create={create} reorder={reorder} rename={rename} remove={remove} />}
          </TabsContent>
        </main>
      </Tabs>

    </AppShell>
  );
}
