"use client";

import { useState, type ReactNode } from "react";
import { CreditSettings } from "./credit-settings";
import { WorkspaceSwitcher } from "@/components/workspace-selection";
import { SettingsSections } from "./settings-sections";
import { WorkspaceCleanup } from "./workspace-cleanup";
import { WorkspaceSettings } from "./workspace-settings";
import { WorkspaceArchive } from "./workspace-archive";

export function WorkspaceSettingsTab({ transferSettings, boardSettings, executorSettings, directorySettings, initialSection, section, onSectionChange }: { transferSettings?: ReactNode; boardSettings?: ReactNode; executorSettings?: ReactNode; directorySettings?: ReactNode; initialSection?: string; section?: string; onSectionChange?: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  return <SettingsSections label="Workspace categories" disabled={busy} initialSection={initialSection} value={section} onValueChange={onSectionChange}
    selector={<WorkspaceSwitcher layout="settings" disabled={busy} />}
    sections={[
      { id: "directory", label: "Directory and worktrees", content: directorySettings ?? <WorkspaceSettings /> },
      ...(boardSettings ? [{ id: "boards", label: "Boards", content: boardSettings }] : []),
      ...(executorSettings ? [{ id: "executors", label: "Executors", content: executorSettings }] : []),
      { id: "credits", label: "Credits", content: <CreditSettings /> },
      ...(transferSettings ? [{ id: "transfer", label: "Import and export", content: transferSettings }] : []),
      { id: "cleanup", label: "Cleanup", content: <WorkspaceCleanup onBusyChange={setBusy} /> },
      { id: "archive", label: "Archive workspace", content: <WorkspaceArchive allowRestore={false} onBusyChange={setBusy} /> },
    ]} />;
}
