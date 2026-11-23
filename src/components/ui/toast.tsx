"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

import { useTheme } from "@/components/theme-provider";

export { toast };

export function dismissLatestNotification() {
  const notification = toast
    .getToasts()
    .filter((item) => !("dismiss" in item) && item.type !== "loading")
    .at(-1);
  if (!notification) return false;
  toast.dismiss(notification.id);
  return true;
}

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      style={{ pointerEvents: "auto" }}
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          borderColor: "var(--border)",
          paddingRight: 48,
        },
        classNames: {
          closeButton: "left-auto! right-3! top-3! transform-none!",
        },
        closeButtonAriaLabel: "Dismiss notification",
      }}
    />
  );
}

// Replace progress with its result, preserving one notification per operation.
export async function notifyOperation<T>(
  operation: () => T | Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string | ((error: unknown) => string);
  },
): Promise<T> {
  const id = toast.loading(messages.loading);
  try {
    const result = await operation();
    toast.success(messages.success, { id });
    return result;
  } catch (error) {
    toast.error(
      typeof messages.error === "function"
        ? messages.error(error)
        : messages.error,
      { id, duration: Infinity },
    );
    throw error;
  }
}
