import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DeleteConfirmation } from "./delete-confirmation";

const meta = {
  title: "Overlays/Delete confirmation",
  component: DeleteConfirmation,
  tags: ["autodocs"],
  args: {
    open: true, title: "Delete task?", description: "Delete this task and its comments? This cannot be undone.",
    busy: false, onOpenChange: fn(), onConfirm: fn(),
  },
} satisfies Meta<typeof DeleteConfirmation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Busy: Story = { args: { busy: true } };

export const Failed: Story = { args: { error: "Could not delete this item. Try again." } };
export const Unavailable: Story = { args: { disabled: true } };
