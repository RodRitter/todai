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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("TASK-1")).toBeVisible();
    await expect(within(canvasElement).getByText("12.34 credits")).toBeVisible();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
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
export const Running: Story = { args: { task: exampleTasks[2] } };
export const Paused: Story = { args: { task: exampleTasks[1] } };
export const Review: Story = { args: { task: exampleTasks[3] } };
export const LongContent: Story = {
  args: {
    task: {
      ...exampleTasks[0],
      title: "Coordinate the design review and resolve every outstanding accessibility and layout issue before the upcoming release",
      description: "Review the board with the team, capture the remaining questions, and document the decisions. Include keyboard navigation, narrow screens, and all execution states in the final review.",
    },
  },
};
export const NarrowLongContent: Story = {
  ...LongContent,
  decorators: [(Story) => <div className="w-52"><Story /></div>],
};
export const UnbrokenTitle: Story = {
  args: { task: { ...exampleTasks[0], title: "InvestigateVeryLongUnbrokenTaskIdentifiersAndEnsureTheyNeverOverflowTheColumnBoundary" } },
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
export const CommentBadgeActivation: Story = {
  ...WithComments,
  play: async ({ canvasElement, args }) => {
    const badge = within(canvasElement).getByRole("button", { name: "1 comment" });
    await userEvent.click(badge);
    await expect(args.onEdit).toHaveBeenCalledTimes(1);
    await expect(args.onEdit).toHaveBeenLastCalledWith(args.task, "activity");
    badge.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onEdit).toHaveBeenCalledTimes(3);
    await expect(args.onEdit).toHaveBeenLastCalledWith(args.task, "activity");
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

export const NoCreditUsage: Story = { args: { task: { ...exampleTasks[0], creditUsage: { credits: 0, calls: 0, priced: 0, pending: 0 } } } };
export const PendingCredits: Story = { args: { task: { ...exampleTasks[0], creditUsage: { credits: 0, calls: 1, priced: 0, pending: 1 } } } };
export const UnavailableCredits: Story = { args: { task: { ...exampleTasks[0], creditUsage: { credits: 0, calls: 1, priced: 0, pending: 0 } } } };
export const PartialCredits: Story = { args: { task: { ...exampleTasks[0], creditUsage: { credits: 12.34, calls: 2, priced: 1, pending: 1 } } } };
