import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        "comment-badge":
          "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        "ghost-primary": "text-primary hover:bg-primary/10 hover:text-primary",
        "ghost-muted": "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "ghost-destructive": "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      weight: { medium: "font-medium", normal: "font-normal" },
      reveal: { always: "", hover: "transition-opacity motion-reduce:transition-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-visible:opacity-100" },
      align: { center: "", start: "justify-start", navigation: "w-full md:justify-start" },
      segment: { standalone: "", start: "rounded-r-none", end: "rounded-l-none border-l border-primary-foreground/25" },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-sm gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-sm px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-7",
        xs: "h-7 gap-1.5 px-2 text-xs has-[>svg]:px-2",
        badge: "min-h-8 gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-normal",
        row: "h-auto w-full justify-start whitespace-normal px-3 py-3 text-left",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  align,
  weight,
  reveal,
  segment,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, align, segment, weight, reveal, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
