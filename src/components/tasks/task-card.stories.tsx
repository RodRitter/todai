import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TaskCard } from "./task-card";
import { exampleTasks } from "./task.fixtures";

const meta = {
  title: "Tasks/Task card",
  component: TaskCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    task: exampleTasks[0],
    onEdit: fn(),
    onDragStart: fn(),
    onDragEnd: fn(),
  },
} satisfies Meta<typeof TaskCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Blocked: Story = { args: { task: exampleTasks[0] } };
export const LongTitle: Story = {
  args: {
    task: {
      ...exampleTasks[0],
      title:
        "Coordinate the design review and prepare all outstanding tasks for the upcoming release",
    },
  },
};
export const Running: Story = {
  args: {
    task: {
      ...exampleTasks[2],
      description: "Create a simple layout for managing tasks.",
    },
  },
};
export const Paused: Story = { args: { task: exampleTasks[1] } };
export const Review: Story = { args: { task: exampleTasks[3] } };
export const LongDescription: Story = { args: { task: exampleTasks[2] } };
export const NoDescription: Story = {
  args: { task: { ...exampleTasks[0], description: "" } },
};
export const Dragging: Story = { args: { isDragging: true } };
export const WithComments: Story = {
  args: {
    task: {
      ...exampleTasks[3],
      comments: [{
        id: "comment-1",
        taskId: exampleTasks[3].id,
        body: "Ready for review.",
        createdAt: "2026-11-17T08:00:00.000Z",
      }],
    },
  },
};
export const KeyboardActivation: Story = {
  play: async ({ canvasElement, args }) => {
    const card = within(canvasElement).getByRole("button");
    card.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onEdit).toHaveBeenCalledWith(args.task);
  },
};
