"use client";

import { useState, type ReactNode } from "react";
import { CreditSettings } from "./credit-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Archive, Plus } from "lucide-react";
import { BreadcrumbRow, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { WorkspaceCleanup } from "./workspace-cleanup";
import { WorkspaceSettings } from "./workspace-settings";
import { WorkspaceArchive } from "./workspace-archive";
import { CreateWorkspace } from "./create-workspace";

export function WorkspaceSettingsTab({ transfer }: { transfer?: ReactNode }) {
  const [view, setView] = useState<"current" | "new" | "archive">("current");
  const [busy, setBusy] = useState(false);

  return <section className="space-y-6" aria-label="Workspace settings">
    <BreadcrumbRow actions={view === "current" && <>
      <Button size="sm" disabled={busy} onClick={() => setView("new")}><Plus />New</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setView("archive")}><Archive />Archived</Button>
    </>}>
      <Breadcrumb aria-label="Workspace breadcrumbs" className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>{view !== "current"
            ? <BreadcrumbLink asChild><button type="button" disabled={busy} onClick={() => setView("current")}>Current workspace</button></BreadcrumbLink>
            : <BreadcrumbPage>Current workspace</BreadcrumbPage>}
          </BreadcrumbItem>
          {view !== "current" && <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{view === "new" ? "New workspace" : "Archived"}</BreadcrumbPage></BreadcrumbItem>
          </>}
        </BreadcrumbList>
      </Breadcrumb>
    </BreadcrumbRow>
    {view === "new" ? <CreateWorkspace onBusyChange={setBusy} />
      : view === "archive" ? <WorkspaceArchive key="restore" allowArchive={false} onBusyChange={setBusy} />
      : <>
        <Card elevation="flat"><CardContent><WorkspaceSettings /></CardContent></Card>
        <Card elevation="flat"><CardContent><CreditSettings /></CardContent></Card>
        {transfer && <Card elevation="flat"><CardContent>{transfer}</CardContent></Card>}
        <Card elevation="flat"><CardContent><WorkspaceCleanup onBusyChange={setBusy} /></CardContent></Card>
        <Card elevation="flat"><CardContent><WorkspaceArchive key="archive" allowRestore={false} onBusyChange={setBusy} /></CardContent></Card>
      </>}
  </section>;
}
