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
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
type DialogExampleProps = ComponentProps<typeof Dialog> & Pick<ComponentProps<typeof DialogContent>, "size" | "closeDisabled" | "layout">;
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
  render: ({ size, closeDisabled, layout, ...args }) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent size={size} closeDisabled={closeDisabled} layout={layout}>
        <DialogHeader>
          <DialogTitle>Example dialog</DialogTitle>
          <DialogDescription>
            Review your changes before continuing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button size="sm" disabled={closeDisabled}>Done</Button>
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

function LongContentExample({ narrow = false }: { narrow?: boolean }) {
  return <Dialog defaultOpen>
    <DialogContent className={narrow ? "max-w-80 sm:max-w-80" : undefined}>
      <DialogHeader><DialogTitle>Long content</DialogTitle><DialogDescription>Scroll to review all items.</DialogDescription></DialogHeader>
      {Array.from({ length: 40 }, (_, index) => <p key={index}>Review item {index + 1}.</p>)}
      <DialogFooter><DialogClose asChild><Button size="sm">Done</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export const LongContent: Story = {
  render: () => <LongContentExample />,
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    const header = dialog.querySelector<HTMLElement>('[data-slot="dialog-header"]')!;
    const viewport = dialog.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const close = within(header).getByRole("button", { name: "Close" });
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    const initialTop = header.getBoundingClientRect().top;
    const initialInset = close.getBoundingClientRect().top - initialTop;
    await expect(initialInset).toBeGreaterThanOrEqual(16);
    viewport.scrollTop = 240;
    await waitFor(() => {
      expect(viewport.scrollTop).toBeGreaterThan(0);
      expect(Math.abs(header.getBoundingClientRect().top - initialTop)).toBeLessThanOrEqual(1);
      expect(close.getBoundingClientRect().top - header.getBoundingClientRect().top).toBeGreaterThanOrEqual(16);
    });
  },
};

export const LongContentDark: Story = { ...LongContent, globals: { theme: "dark" } };
export const LongContentNarrow: Story = { ...LongContent, render: () => <LongContentExample narrow /> };

export const Prompt: Story = { args: { defaultOpen: true, layout: "prompt" } };
