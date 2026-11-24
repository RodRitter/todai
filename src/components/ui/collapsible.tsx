"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { preserveScroll } from "./preserve-scroll";

const OpenContext = React.createContext(false);

function Collapsible({ open: controlled, defaultOpen = false, onOpenChange, children, ref, scrollBehavior = "preserve", ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root> & { scrollBehavior?: "preserve" | "follow-expansion" }) {
  const [local, setLocal] = React.useState(defaultOpen);
  const node = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => node.current!);
  const open = controlled ?? local;
  const stopScrolling = React.useRef<(() => void) | undefined>(undefined);
  React.useEffect(() => () => stopScrolling.current?.(), []);
  return <OpenContext.Provider value={open}>
    <CollapsiblePrimitive.Root {...props} ref={node} open={open} onOpenChange={(value) => {
      stopScrolling.current = preserveScroll(node.current, value ? scrollBehavior : "preserve");
      setLocal(value);
      onOpenChange?.(value);
    }}>{children}</CollapsiblePrimitive.Root>
  </OpenContext.Provider>;
}
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

function CollapsibleContent({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  const open = React.useContext(OpenContext);
  const [previous, setPrevious] = React.useState(open);
  const [animating, setAnimating] = React.useState(false);
  if (open !== previous) {
    setPrevious(open);
    setAnimating(true);
  }
  React.useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(() => setAnimating(false), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
    return () => clearTimeout(timer);
  }, [open, animating]);
  return <CollapsiblePrimitive.Content {...props} forceMount hidden={!open && !animating} inert={!open} aria-hidden={!open}
    data-slot="collapsible-content" className={cn(className,
      animating && "overflow-hidden data-[state=open]:animate-[collapse-open_200ms_ease-out_both] data-[state=closed]:animate-[collapse-close_200ms_ease-out_both] motion-reduce:animate-none",
    )} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
