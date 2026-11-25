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
    <CollapsibleContent><div className={compactOnMobile ? "space-y-1 border-l border-border md:ml-4 md:pl-2" : "ml-4 space-y-1 border-l border-border pl-2"}>{children}</div></CollapsibleContent>
  </Collapsible>;
}
