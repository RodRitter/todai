import type { ComponentProps } from "react";
import { InputGroupButton } from "./input-group";
import { cn } from "@/lib/utils";

export function PromptSend({ className, ...props }: ComponentProps<typeof InputGroupButton>) {
  return <InputGroupButton size="icon-sm" variant="default" className={cn("rounded-full", className)} {...props} />;
}
