import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { fn } from "storybook/test";
const meta = {
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  title: "Actions/Button",
  component: Button,
  args: { children: "Button", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "outline",
        "ghost",
        "ghost-muted",
        "ghost-primary",
        "ghost-destructive",
        "destructive",
        "link",
      ],
    },
    size: { control: "select", options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "row"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const GhostPrimary: Story = { args: { variant: "ghost-primary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const Link: Story = { args: { variant: "link" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Disabled: Story = { args: { disabled: true } };
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <PlusIcon /> Add item
      </>
    ),
  },
};
export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Add item", children: <PlusIcon /> },
};
export const Loading: Story = {
  args: {
    disabled: true,
    "aria-busy": true,
    children: (
      <>
        <Loader2Icon className="animate-spin motion-reduce:animate-none" />{" "}
        Please wait
      </>
    ),
  },
};
export const AsChild: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#button">Link button</a>
    </Button>
  ),
};

export const Quiet: Story = { args: { variant: "ghost-muted" } };
export const QuietDestructive: Story = { args: { variant: "ghost-destructive", children: "Delete" } };
export const ExtraSmall: Story = { args: { size: "xs" } };
export const CompactIcon: Story = { args: { size: "icon-xs", "aria-label": "Add item", children: <PlusIcon /> } };
export const MultilineRow: Story = { args: { size: "row", variant: "ghost-muted", children: "A long action label that wraps in a narrow container" }, decorators: [(Story) => <div className="w-48"><Story /></div>] };
export const SplitAction: Story = { render: () => <div className="flex"><Button segment="start">Create artifact</Button><Button segment="end" size="icon" aria-label="Choose artifact type"><PlusIcon /></Button></div> };
