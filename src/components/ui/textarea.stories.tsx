import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./textarea";
import { Label } from "./label";
const meta = {
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  title: "Forms/Textarea",
  component: Textarea,
  args: {
    id: "textarea-example",
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
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Example value" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = {
  args: { "aria-invalid": true, "aria-describedby": "textarea-error" },
  render: (args) => (
    <div className="grid gap-2">
      <Textarea {...args} />
      <p id="textarea-error" className="text-sm text-destructive">
        A value is required.
      </p>
    </div>
  ),
};
export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-2">
      <Label htmlFor={args.id}>Value</Label>
      <Textarea {...args} aria-label={undefined} />
    </div>
  ),
};
export const Code: Story = { args: { variant: "code", defaultValue: "# Instructions\n\nUse existing components." } };
