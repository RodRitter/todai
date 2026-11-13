import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Dialog } from "./dialog";
import {
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Button } from "./button";
import { fn } from "storybook/test";
const meta = {
  title: "Overlays/Dialog",
  component: Dialog,
  args: { onOpenChange: fn() },
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Example dialog</DialogTitle>
          <DialogDescription>
            A basic dialog with the default shadcn styling.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const InitiallyOpen: Story = {
  args: { defaultOpen: true },
  tags: ["!autodocs"],
};
