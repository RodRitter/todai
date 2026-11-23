import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { CreateWorkspace } from "./create-workspace";

const meta = {
  title: "Tasks/Fresh setup",
  component: CreateWorkspace,
  args: { firstRun: true },
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/directories?") ? Response.json([]) : original(input, options);
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof CreateWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FreshSetup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Workspace name"), "Project");
    await userEvent.type(canvas.getByLabelText("Project folder"), "/tmp");
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Your name"), "Roderick");
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeEnabled();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
