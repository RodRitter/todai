import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Dialog } from "./dialog";
import {
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Button } from "./button";
import { expect, fn, userEvent, within } from "storybook/test";
type DialogExampleProps = ComponentProps<typeof Dialog> & Pick<ComponentProps<typeof DialogContent>, "size" | "closeDisabled">;
const meta = {
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  title: "Overlays/Dialog",
  component: Dialog,
  subcomponents: {
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
  },
  args: { onOpenChange: fn() },
  render: ({ size, closeDisabled, ...args }) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent size={size} closeDisabled={closeDisabled}>
        <DialogHeader>
          <DialogTitle>Example dialog</DialogTitle>
          <DialogDescription>
            Review your changes before continuing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={closeDisabled}>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<DialogExampleProps>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const InitiallyOpen: Story = {
  args: { defaultOpen: true },
  tags: ["!autodocs"],
};

export const Wide: Story = { args: { defaultOpen: true, size: "wide" } };
export const Large: Story = { args: { defaultOpen: true, size: "large" } };
export const Busy: Story = {
  args: { defaultOpen: true, closeDisabled: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(dialog).toBeVisible();
  },
};
