import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";
const meta = {
  title: "Forms/Input",
  component: Input,
  args: {
    id: "input-example",
    placeholder: "Enter a value",
    "aria-label": "Example value",
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Example value" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = {
  args: { "aria-invalid": true, "aria-describedby": "input-error" },
  render: (args) => (
    <div className="grid gap-2">
      <Input {...args} />
      <p id="input-error" className="text-sm text-destructive">
        A value is required.
      </p>
    </div>
  ),
};
export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-2">
      <Label htmlFor={args.id}>Value</Label>
      <Input {...args} aria-label={undefined} />
    </div>
  ),
};
export const Password: Story = {
  args: { type: "password", defaultValue: "example-password" },
};
