import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TaskColumn } from "./task-column";
import { TaskCard } from "./task-card";
import { exampleTasks } from "./task.fixtures";
import { statuses } from "./task";

const meta = {
  title: "Tasks/Task column",
  component: TaskColumn,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-80 max-w-full"><Story /></div>],
  argTypes: { status: { control: "select", options: statuses }, children: { control: false } },
  args: { status: "To do", onDrop: fn(), onDragOver: fn(), onDragLeave: fn() },
} satisfies Meta<typeof TaskColumn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { children: exampleTasks.slice(0, 2).map((task) => <TaskCard key={task.id} task={task} onEdit={fn()} />) },
};
export const Empty: Story = { args: { status: "In review", isEmpty: true } };
export const DropTarget: Story = { args: { ...Empty.args, canDrop: true, isDropTarget: true } };

export const AssignedAgent: Story = { args: { ...Empty.args, agentName: 'Reviewer', onConfigureAgent: fn() } };
export const LongAgentName: Story = { args: { ...AssignedAgent.args, agentName: 'Architecture and implementation review specialist' } };
