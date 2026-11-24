"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;
export const AccordionItem = AccordionPrimitive.Item;

export function AccordionTrigger({ children, className, metadata, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger> & { metadata?: React.ReactNode }) {
  return <AccordionPrimitive.Header>
    <AccordionPrimitive.Trigger className={cn("group flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", className)} {...props}>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {metadata && <span aria-hidden="true" className="shrink-0 text-xs font-normal text-muted-foreground">{metadata}</span>}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>;
}

export function AccordionContent({ children, className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return <AccordionPrimitive.Content className={cn("min-w-0 px-3 pb-4 text-sm", className)} {...props}>{children}</AccordionPrimitive.Content>;
}
