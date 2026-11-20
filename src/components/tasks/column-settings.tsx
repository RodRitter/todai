"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  tab,
  onTabChange,
}: {
  boardSettings?: ReactNode;
  tab?: "general" | "workspaces" | "board" | "executors";
  executorSettings?: ReactNode;
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
  return (
    <AppShell screen="settings">
      <Tabs defaultValue="general" value={tab} onValueChange={onTabChange} asChild>
        <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="general">General</TabsTrigger>
            {workspaceSettings && <TabsTrigger value="workspaces">Workspace</TabsTrigger>}
            <TabsTrigger value="board">Board</TabsTrigger>
            {executorSettings && <TabsTrigger value="executors">Executors</TabsTrigger>}
          </TabsList>
          <TabsContent value="general" forceMount className="space-y-8">
            {generalSettings}
          </TabsContent>
          {workspaceSettings && <TabsContent value="workspaces" forceMount className="space-y-8">{workspaceSettings}</TabsContent>}
          {executorSettings && <TabsContent value="executors" forceMount>{executorSettings}</TabsContent>}
          <TabsContent value="board" forceMount className="space-y-8">
            {boardSettings ?? <ColumnEditor initialColumns={initialColumns} initialTaskCounts={initialTaskCounts}
              create={create} reorder={reorder} rename={rename} remove={remove} />}
          </TabsContent>
        </main>
      </Tabs>

    </AppShell>
  );
}
