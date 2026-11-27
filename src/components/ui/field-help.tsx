"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

/** Optional field help. The description stays available to assistive technology. */
export function FieldHelp({ id, label, children }: { id: string; label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <span id={id} className="sr-only">{children}</span>
    <TooltipProvider><Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost-muted" size="icon-xs" aria-label={`Help for ${label}`} onClick={() => setOpen(true)}>
          <CircleHelp aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip></TooltipProvider>
  </>;
}
