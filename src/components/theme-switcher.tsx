"use client";

import { useId } from "react";
import { Moon } from "lucide-react";
import { Popover } from "radix-ui";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ThemeSwitcher() {
  const id = useId();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance" title="Appearance">
          <Moon aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} aria-label="Appearance" className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={id}>Dark mode</Label>
            <Switch id={id} checked={resolvedTheme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
