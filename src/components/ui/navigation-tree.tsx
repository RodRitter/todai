"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "./button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

// The board tree and chat tree share all row spacing and indentation.
export function NavigationTree({ label, children, compactOnMobile = false }: { label: string; children: ReactNode; compactOnMobile?: boolean }) {
  const [open, setOpen] = useState(true);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" align="navigation" aria-label={label}>
        <FolderOpen /><span className={compactOnMobile ? "hidden min-w-0 flex-1 text-left md:inline" : "min-w-0 flex-1 text-left"}>{label}</span>
        <span className={compactOnMobile ? "hidden md:inline" : undefined}>{open ? <ChevronDown /> : <ChevronRight />}</span>
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent><div className={compactOnMobile ? "group/navigation space-y-1 border-l border-border md:ml-4 md:pl-2" : "group/navigation ml-4 space-y-1 border-l border-border pl-2"}>{children}</div></CollapsibleContent>
  </Collapsible>;
}

export function NavigationTreeRow({ dragging = false, insertion, children, ...props }: React.ComponentProps<"div"> & { dragging?: boolean; insertion?: "before" | "after" }) {
  return <div {...props} data-dragging={dragging} className="group relative flex min-w-0 items-center data-[dragging=true]:opacity-40">
    {insertion && <span aria-hidden="true" data-insertion={insertion} className="pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-primary data-[insertion=before]:-top-0.5 data-[insertion=after]:-bottom-0.5" />}
    {children}
  </div>;
}
