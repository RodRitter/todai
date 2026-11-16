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
        "destructive",
        "link",
      ],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
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
        <Loader2Icon className="animate-spin motion-reduce:animate-none" /> Please wait
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
