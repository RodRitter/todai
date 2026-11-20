"use client";
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { dismissLatestNotification } from "./toast";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";
import { Button } from "./button";

const DialogCloseContext = React.createContext({ show: true, disabled: false });

export const modalContentClassName = "bg-background fixed top-1/2 left-1/2 z-50 flex flex-col max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border shadow-lg sm:max-w-lg";

export const modalTitleClassName = "col-start-1 row-start-1 min-w-0 text-left text-sm leading-snug font-medium text-muted-foreground wrap-anywhere";

export function ModalCloseButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" {...props}>
      <XIcon />
    </Button>
  );
}

export function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("sticky top-0 z-10 -mx-4 -mt-4 grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-2 bg-background p-4 [&>[data-slot=dialog-description]]:col-span-full [&>[data-slot=dialog-close]]:col-start-2 [&>[data-slot=dialog-close]]:row-start-1", className)}
      {...props}
    />
  );
}
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}
function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>,
) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}
function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}
function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeDisabled = false,
  size = "default",
  layout = "default",
  onInteractOutside,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  closeDisabled?: boolean;
  size?: "default" | "wide" | "large" | "expanded";
  layout?: "default" | "workspace" | "prompt";
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          modalContentClassName,
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 motion-reduce:animate-none",
          size === "wide" && "sm:max-w-2xl",
          size === "large" && "sm:max-w-3xl",
          size === "expanded" && "sm:max-w-[calc(100%-2rem)]",
          layout === "workspace" && "grid h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 px-4 [&>[data-slot=dialog-header]]:mt-0",
          layout === "prompt" && "rounded-xl",
          className,
        )}
        {...props}
        onInteractOutside={(event) => {
          if (closeDisabled) event.preventDefault();
          if (
            event.target instanceof Element &&
            event.target.closest("[data-sonner-toaster]")
          ) {
            event.preventDefault();
          }
          onInteractOutside?.(event);
        }}
        onEscapeKeyDown={(event) => {
          if (closeDisabled) event.preventDefault();
          onEscapeKeyDown?.(event);
          if (!event.defaultPrevented && dismissLatestNotification())
            event.preventDefault();
        }}
      >
        <DialogCloseContext.Provider value={{ show: showCloseButton, disabled: closeDisabled }}>
          {layout === "workspace" ? children : <ScrollArea variant="modal">{children}</ScrollArea>}
        </DialogCloseContext.Provider>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
function DialogHeader({ children, className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "actions" | "task" }) {
  const { show, disabled } = React.useContext(DialogCloseContext);
  return (
    <ModalHeader data-slot="dialog-header" className={cn(variant !== "default" && "grid-cols-[minmax(0,1fr)_auto_2rem] [&>[data-slot=dialog-close]]:col-start-3", variant === "task" && "px-6 pb-6", className)} {...props}>
      {show ? (
        <DialogClose asChild>
          <ModalCloseButton disabled={disabled} />
        </DialogClose>
      ) : <span data-slot="dialog-close" aria-hidden="true" className="size-8" />}
      {children}
    </ModalHeader>
  );
}
function DialogFooter({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "workspace" | "task" }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        variant !== "default" && "z-10 shrink-0 flex-row flex-wrap items-center justify-end bg-background px-4 py-2",
        variant === "task" && "px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(modalTitleClassName, className)}
      {...props}
    />
  );
}
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
