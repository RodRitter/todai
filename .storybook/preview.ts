import { createElement, useEffect, type ReactNode } from "react";
import { Toaster, toast } from "../src/components/ui/toast";
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

function PreviewTheme({ theme, children }: { theme: string; children?: ReactNode }) {
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", theme === "dark");
    return () => { document.documentElement.classList.toggle("dark", wasDark); };
  }, [theme]);
  return createElement("div", { className: "font-sans antialiased text-foreground" }, children);
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Application color theme (including modal portals)",
      toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [(Story, context) => createElement(PreviewTheme, { theme: context.globals.theme }, createElement("div", null, createElement(Story), createElement(Toaster)))],
  beforeEach: () => { toast.dismiss(); return () => { toast.dismiss(); }; },
  parameters: {
    nextjs: { appDirectory: true },
  },
};

export default preview;
