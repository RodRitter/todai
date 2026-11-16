import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExecutorSettings } from "./executor-settings";

const meta = {
  title: "Settings/Executor tools",
  component: ExecutorSettings,
  tags: ["autodocs"],
  args: {
    load: async () => ({ defaultExecutor: "codex", statuses: [
      { tool: "codex", installed: true, signedIn: true, message: "Installed and signed in." },
      { tool: "claude", installed: false, signedIn: null, message: "Install Claude Code and sign in to connect." },
    ] }),
    save: async (defaultExecutor) => ({ defaultExecutor }),
    test: async () => ({ message: "Executor test passed." }),
  },
} satisfies Meta<typeof ExecutorSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
export const SignInFailure: Story = {
  args: {
    test: async () => {
      throw new Error("Sign-in check: exited with code 1. Run `codex login` as the same user running the app server, then retry.\n\nCodex details:\nNot logged in");
    },
  },
};
export const Testing: Story = {
  args: {
    test: () => new Promise((resolve) => {
      setTimeout(() => resolve({ message: "Executor test passed." }), 5000);
    }),
  },
};
