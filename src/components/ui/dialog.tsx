"use client";
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { dismissLatestNotification } from "./toast";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const DialogCloseContext = React.createContext({ show: true, disabled: false });

export const modalContentClassName = "bg-background fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-3xl border p-6 shadow-lg sm:max-w-lg";

export const modalTitleClassName = "col-start-2 row-start-1 min-w-0 text-right text-sm leading-snug font-medium text-muted-foreground wrap-anywhere";

export function ModalCloseButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Close" {...props}>
      <XIcon className="size-5" />
    </Button>
  );
}

export function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("sticky -top-6 z-10 -mx-6 -mt-6 grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-t-3xl border-b bg-background px-6 py-4 [&>[data-slot=dialog-description]]:col-span-2", className)}
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
  onInteractOutside,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  closeDisabled?: boolean;
  size?: "default" | "wide" | "large" | "expanded";
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
          {children}
        </DialogCloseContext.Provider>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
function DialogHeader({ children, ...props }: React.ComponentProps<"div">) {
  const { show, disabled } = React.useContext(DialogCloseContext);
  return (
    <ModalHeader data-slot="dialog-header" {...props}>
      {show ? (
        <DialogPrimitive.Close asChild>
          <ModalCloseButton disabled={disabled} />
        </DialogPrimitive.Close>
      ) : <span aria-hidden="true" className="size-9" />}
      {children}
    </ModalHeader>
  );
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
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
