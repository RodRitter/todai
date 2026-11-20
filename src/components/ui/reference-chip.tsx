import type { ComponentProps, ReactNode } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

export function ReferenceChip({ asChild = false, icon, children, className, ...props }: ComponentProps<"button"> & { asChild?: boolean; icon?: ReactNode }) {
  const Component = asChild ? Slot.Root : "button";
  return <Component data-slot="reference-chip" className={cn(
    "inline cursor-pointer rounded-md border border-primary/15 bg-primary/5 px-1.5 py-0.5 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
    className,
  )} {...props}>
    {icon && <span aria-hidden="true" className="mr-1 inline [&>svg]:inline [&>svg]:size-3.5 [&>svg]:align-text-bottom">{icon}</span>}
    <Slot.Slottable>{children}</Slot.Slottable>
  </Component>;
}
