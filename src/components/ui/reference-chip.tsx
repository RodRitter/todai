import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

export type ReferenceKind = "agent" | "artifact" | "comment" | "skill" | "file";

export function ReferenceChip({ asChild = false, kind = "file", children, className, ...props }: ComponentProps<"button"> & { asChild?: boolean; kind?: ReferenceKind }) {
  const Component = asChild ? Slot.Root : "button";
  return <Component data-slot="reference-chip" data-reference-kind={kind} className={cn(
    "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
    className,
  )} {...props}>
    <Slot.Slottable>{children}</Slot.Slottable>
  </Component>;
}
