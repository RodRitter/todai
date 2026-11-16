import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { NativeSelect } from "./native-select";
import { Label } from "./label";

const meta = {
  title: "Forms/Native select",
  component: NativeSelect,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    id: "select-example",
    "aria-label": "Status",
    defaultValue: "To do",
    onChange: fn(),
    children: ["To do", "In progress", "In review", "Done"].map((value) => (
      <option key={value}>{value}</option>
    )),
  },
} satisfies Meta<typeof NativeSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: "In progress" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = {
  args: { "aria-invalid": true, "aria-describedby": "select-error" },
  render: (args) => (
    <div className="space-y-2">
      <NativeSelect {...args} />
      <p id="select-error" className="text-destructive text-sm">
        Choose an available status.
      </p>
    </div>
  ),
};
export const WithLabel: Story = {
  render: (args) => (
    <div className="space-y-2">
      <Label htmlFor={args.id}>Status</Label>
      <NativeSelect {...args} aria-label={undefined} />
    </div>
  ),
};
export const PropertyRow: Story = {
  render: (args) => (
    <div className="bg-muted/50 flex w-72 max-w-full items-center justify-between gap-3 rounded-xl p-4">
      <Label htmlFor={args.id} className="text-muted-foreground font-normal">
        Status
      </Label>
      <NativeSelect
        {...args}
        aria-label={undefined}
        className="bg-background dark:bg-background h-10 w-40 rounded-lg border-transparent shadow-none hover:bg-accent"
      />
    </div>
  ),
};
