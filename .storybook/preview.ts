import { createElement } from "react";
import { Toaster, toast } from "../src/components/ui/toast";
import { ThemeProvider } from "../src/components/theme-provider";
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Application color theme (including modal portals)",
      toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [(Story, context) => createElement(ThemeProvider, { forcedTheme: context.parameters.liveTheme ? undefined : context.globals.theme }, createElement("div", { className: "font-sans antialiased text-foreground" }, createElement(Story), createElement(Toaster)))],
  beforeEach: () => { toast.dismiss(); return () => { toast.dismiss(); }; },
  parameters: {
    nextjs: { appDirectory: true },
  },
};

export default preview;
