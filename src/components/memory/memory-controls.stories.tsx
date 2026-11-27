import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MemoryControls } from "./memory-controls";

const entry = { id: "record", revision: 2, category: "Practices" as const, title: "Settings feedback", statement: "Use shared toast helpers.", details: "Keep retry controls accessible.", scope: "Settings forms", source: "[Task source](#task/source)", updatedAt: "2026-11-27T00:00:00Z" };
const meta = {
  title: "Memory/Controls", component: MemoryControls,
  args: { entry, onChange: fn(), change: fn(async () => ({ changed: true })), history: fn(async () => [{ entry, reason: "Updated after verification." }]) },
} satisfies Meta<typeof MemoryControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Correct: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Correct" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.clear(dialog.getByLabelText("Summary"));
    await userEvent.type(dialog.getByLabelText("Summary"), "Use notifyOperation for save feedback.");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(args.change).toHaveBeenCalledWith(expect.objectContaining({ operation: "update", revision: 2, statement: "Use notifyOperation for save feedback." }));
  },
};
export const FlagForReview: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Mark for review" }));
    await expect(args.change).toHaveBeenCalledWith(expect.objectContaining({ needsReview: true }));
  },
};
export const History: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "History" }));
    await expect(await within(canvasElement.ownerDocument.body).findByText("Updated after verification.")).toBeVisible();
  },
};
export const Retire: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Retire" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(args.change).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Retire" }));
    await expect(args.change).toHaveBeenCalledWith(expect.objectContaining({ operation: "remove", revision: 2 }));
  },
};
export const Retired: Story = { args: { entry: { ...entry, retired: true } } };
export const Pending: Story = { ...Correct, args: { change: fn(() => new Promise(() => {})) } };
export const Failure: Story = { ...Correct, args: { change: fn(async () => { throw new Error("Memory entry changed. Reload before saving."); }) } };
export const Dark: Story = { ...History, globals: { theme: "dark" } };
