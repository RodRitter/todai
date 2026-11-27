"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfigurationTransfer } from "./configuration-transfer";
import { CreateWorkspace } from "./create-workspace";
import { CreditSettings } from "./credit-settings";
import { WorkspaceSwitcher } from "@/components/workspace-selection";
import { SettingsSections } from "./settings-sections";
import { WorkspaceCleanup } from "./workspace-cleanup";
import { WorkspaceSettings } from "./workspace-settings";
import { WorkspaceArchive } from "./workspace-archive";

export function WorkspaceSettingsTab({ transferSettings, boardSettings, executorSettings, directorySettings, initialSection, section, onSectionChange }: { transferSettings?: ReactNode; boardSettings?: ReactNode; executorSettings?: ReactNode; directorySettings?: ReactNode; initialSection?: string; section?: string; onSectionChange?: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingBusy, setCreatingBusy] = useState(false);
  return <SettingsSections label="Workspace categories" disabled={busy} initialSection={initialSection === "transfer" ? "directory" : initialSection} value={section === "transfer" ? "directory" : section} onValueChange={onSectionChange}
    actions={<fieldset disabled={busy}>{transferSettings}</fieldset>}
    selector={<div className="space-y-2">
      <div className="min-w-0"><WorkspaceSwitcher layout="settings" disabled={busy || creatingBusy} /></div>
      <div role="group" aria-label="New workspace actions" className="flex w-full">
      <Dialog open={creating} onOpenChange={open => { if (!creatingBusy) setCreating(open); }}>
        <DialogTrigger asChild><Button segment="start" className="flex-1" disabled={busy}><Plus aria-hidden="true" />New workspace</Button></DialogTrigger>
        <DialogContent size="wide" aria-describedby={undefined} closeDisabled={creatingBusy}>
          <DialogHeader><DialogTitle>New workspace</DialogTitle></DialogHeader>
          <ScrollArea variant="modal" className="max-h-[70vh]">
            <CreateWorkspace onBusyChange={setCreatingBusy} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <ConfigurationTransfer scope="import" disabled={busy || creatingBusy} onImported={() => window.location.reload()}
        importTrigger={(open, importing) => <DropdownMenu>
          <DropdownMenuTrigger asChild><Button segment="end" size="icon" disabled={importing} aria-label="More workspace actions" title="More workspace actions"><ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => { requestAnimationFrame(open); }}><Upload aria-hidden="true" />Import configuration</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>} />
      </div>
    </div>}
    sections={[
      { id: "directory", label: "Environment", content: directorySettings ?? <WorkspaceSettings /> },
      ...(boardSettings ? [{ id: "boards", label: "Boards", content: boardSettings }] : []),
      ...(executorSettings ? [{ id: "executors", label: "AI tools", content: executorSettings }] : []),
      { id: "credits", label: "Tracking", content: <CreditSettings /> },
      { id: "maintenance", label: "Maintenance", content: <fieldset disabled={busy} aria-label="Maintenance" className="space-y-6">
        <WorkspaceCleanup onBusyChange={setBusy} />
        <WorkspaceArchive allowRestore={false} onBusyChange={setBusy} />
      </fieldset> },
    ]} />;
}
