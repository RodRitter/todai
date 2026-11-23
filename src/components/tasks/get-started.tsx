"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateWorkspace } from "./create-workspace";
import { WorkspaceArchive } from "./workspace-archive";

export function GetStarted() {
  const [busy, setBusy] = useState(false);
  return <main className="min-h-svh bg-muted/20">
    <Dialog open>
      <DialogContent size="wide" showCloseButton={false} closeDisabled>
        <div className="space-y-2 pt-2 text-center">
          <p className="text-3xl font-semibold tracking-tight">Todai</p>
          <DialogTitle className="text-center text-xl font-medium text-foreground">Get Started</DialogTitle>
          <DialogDescription className="sr-only">Create your workspace, customize its columns, and choose optional agents.</DialogDescription>
        </div>
        <CreateWorkspace firstRun onBusyChange={setBusy} />
        <fieldset disabled={busy}>
          <Collapsible>
            <CollapsibleTrigger asChild><Button type="button" variant="ghost-muted" size="sm">Restore an archived workspace</Button></CollapsibleTrigger>
            <CollapsibleContent className="pt-4"><WorkspaceArchive allowArchive={false} /></CollapsibleContent>
          </Collapsible>
        </fieldset>
      </DialogContent>
    </Dialog>
  </main>;
}
