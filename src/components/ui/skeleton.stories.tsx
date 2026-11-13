import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

const meta = {
  title: "Feedback/Skeleton",
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { className: "h-4 w-64", "aria-hidden": true },
};
export const Circle: Story = {
  args: { className: "size-12 rounded-full", "aria-hidden": true },
};
