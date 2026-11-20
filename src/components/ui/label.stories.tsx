import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Input } from "./input";
const meta = {
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  title: "Forms/Label",
  component: Label,
  args: { children: "Label", htmlFor: "label-example" },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <div className="grid w-80 max-w-full gap-2">
      <Label {...args} />
      <Input id={args.htmlFor} />
    </div>
  ),
};
export const Disabled: Story = {
  render: (args) => (
    <div className="group grid w-80 max-w-full gap-2" data-disabled="true">
      <Label {...args} />
      <Input id={args.htmlFor} disabled />
    </div>
  ),
};
export const Metadata: Story = { ...Default, args: { variant: "metadata" } };
export const Caption: Story = { ...Default, args: { variant: "caption" } };
