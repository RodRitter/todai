import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "./card";
import { Button } from "./button";

type CardExampleProps = ComponentProps<typeof Card> & {
  heading: string;
  description: string;
  actions: "none" | "primary" | "confirm" | "edit";
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

const meta = {
  title: "Layout/Card",
  component: Card,
  subcomponents: { CardHeader, CardTitle, CardDescription, CardFooter },
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "compact", "task"] },
    actions: {
      control: "select",
      options: ["none", "primary", "confirm", "edit"],
    },
    heading: { control: "text" },
    description: { control: "text" },
    children: { control: false },
  },
  args: {
    variant: "default",
    heading: "Plan the next release",
    description: "Organize the work and review what is ready to ship.",
    actions: "confirm",
    onConfirm: fn(),
    onCancel: fn(),
    onDelete: fn(),
  },
  render: ({
    heading,
    description,
    actions,
    onConfirm,
    onCancel,
    onDelete,
    ...args
  }) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        {description && (
          <CardDescription>
            {description}
          </CardDescription>
        )}
      </CardHeader>
      {actions !== "none" && (
        <CardFooter className="justify-end">
          {actions === "edit" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground mr-auto px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
          <div className="flex items-center gap-1.5">
            {actions !== "primary" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground px-2 text-xs"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button size="sm" className="px-3 text-xs" onClick={onConfirm}>
              {actions === "edit" ? "Save" : "Continue"}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  ),
} satisfies Meta<CardExampleProps>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const HeaderOnly: Story = { args: { actions: "none" } };
export const TitleOnly: Story = { args: { actions: "none", description: "" } };
export const Compact: Story = { args: { variant: "compact" } };
export const PrimaryAction: Story = { args: { actions: "primary" } };
export const EditActions: Story = { args: { actions: "edit" } };
export const CompactEditActions: Story = {
  args: { variant: "compact", actions: "edit" },
};
export const LongContent: Story = {
  args: {
    heading: "Coordinate the design review and prepare the next release",
    description:
      "Collect feedback from the team, resolve outstanding questions, and document the decisions so everyone can move forward with a clear understanding of the work.",
    actions: "primary",
  },
};

export const Task: Story = { args: { variant: "task", actions: "edit" } };
