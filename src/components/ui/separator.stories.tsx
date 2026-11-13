import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Separator } from "./separator";

const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Horizontal: Story = {
  render: (args) => (
    <div className="w-80">
      <Separator {...args} />
    </div>
  ),
};
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="h-16">
      <Separator {...args} />
    </div>
  ),
};
