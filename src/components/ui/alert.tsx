import type { ComponentProps } from "react";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  success: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function Alert({
  variant = "info",
  title,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { variant?: keyof typeof variants; title: string }) {
  const Icon = variant === "success" ? CircleCheck : variant === "error" ? CircleX : Info;
  return (
    <div role={variant === "error" ? "alert" : "status"} aria-atomic="true"
      className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", variants[variant], className)} {...props}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{title}</p>
        {children && <div className="whitespace-pre-wrap break-words">{children}</div>}
      </div>
    </div>
  );
}
