import { createElement } from "react";
import { Toaster, toast } from "../src/components/ui/toast";
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [(Story) => createElement("div", null, createElement(Story), createElement(Toaster))],
  beforeEach: () => { toast.dismiss(); return () => { toast.dismiss(); }; },
  parameters: {
    nextjs: { appDirectory: true },
  },
};

export default preview;
