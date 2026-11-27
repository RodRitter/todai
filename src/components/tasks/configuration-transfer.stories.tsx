import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ConfigurationTransfer } from "./configuration-transfer";
import type { Configuration } from "@/domain/configuration";

const configuration: Configuration = {
  format: "todai-configuration", version: 1, agents: [], columns: [], assignments: [],
  memory: { entries: [{ id: "decision", revision: 1, category: "Decisions", title: "Keep source evidence with accepted workspace decisions", statement: "Keep evidence.", scope: "Workspace", source: "User", updatedAt: "2026-11-27" }], tasks: [], artifacts: [] },
};
const meta = {
  title: "Tasks/Configuration transfer",
  component: ConfigurationTransfer,
  args: { onImported: fn() },
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/configuration")
      ? Response.json(options?.method === "POST" ? { agents: 0, columns: 0, assignments: 0, memory: 1 } : configuration)
      : original(input, options);
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof ConfigurationTransfer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MemorySelection: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Export" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByRole("checkbox", { name: configuration.memory!.entries[0].title })).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Export selected" })).toBeEnabled();
    await userEvent.click(dialog.getByRole("button", { name: "Clear memory" }));
    await expect(dialog.getByRole("button", { name: "Export selected" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "Select all memory" }));
    await expect(dialog.getByRole("button", { name: "Export selected" })).toBeEnabled();
  },
};
export const Dark: Story = { ...MemorySelection, globals: { theme: "dark" } };
export const MemoryImport: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText("Import configuration file"), new File([JSON.stringify(configuration)], "memory.json", { type: "application/json" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Import selected" }));
    await expect(args.onImported).toHaveBeenCalled();
  },
};
