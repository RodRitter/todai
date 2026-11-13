import { useEffect } from "react";
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Component color theme",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    nextjs: { appDirectory: true },
    options: {
      storySort: {
        order: [
          "Actions",
          "Forms",
          "Feedback",
          "Navigation",
          "Overlays",
          "Primitives",
        ],
      },
    },
  },
  decorators: [
    function ThemeDecorator(Story, context) {
      useEffect(() => {
        // Apply to the document so portaled dialogs receive the same theme.
        const root = document.documentElement;
        root.classList.toggle("dark", context.globals.theme === "dark");
        return () => root.classList.remove("dark");
      }, [context.globals.theme]);
      return <Story />;
    },
  ],
};
export default preview;
