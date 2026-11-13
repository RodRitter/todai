import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { fn } from "storybook/test";
const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  args: {
    id: "checkbox-example",
    "aria-label": "Enable option",
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
};
export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox {...args} aria-label={undefined} />
      <Label htmlFor={args.id}>Enable option</Label>
    </div>
  ),
};
export const Indeterminate: Story = {
  args: { defaultChecked: "indeterminate" },
};
