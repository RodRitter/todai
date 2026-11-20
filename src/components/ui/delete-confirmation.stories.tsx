import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    await expect(cancel).toHaveFocus();
    await userEvent.click(cancel);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement, args }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
    await userEvent.click(canvasElement.ownerDocument.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!);
    await userEvent.keyboard("{Escape}");
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const DiscardChanges: Story = {
  args: { title: "Discard unsaved skill changes?", description: "Your unsaved changes will be lost.", confirmLabel: "Discard" },
  play: async ({ canvasElement, args }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    await expect(args.onConfirm).toHaveBeenCalledOnce();
  },
};

export const Failed: Story = { args: { error: "Could not delete this item. Try again." } };
export const Unavailable: Story = { args: { disabled: true } };

export const OutsideClick: Story = {
  play: async ({ canvasElement, args }) => {
    const body = canvasElement.ownerDocument.body;
    await within(body).findByRole("dialog");
    const overlay = body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;
    await userEvent.click(overlay);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};
export const LongContent: Story = {
  args: {
    title: "Delete this task and all its saved comments and attachments?",
    description: "Review the task before you delete it. This action deletes the task and its comments. You cannot restore this task.",
  },
};
