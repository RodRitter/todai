import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AgentStatus } from "./agent-status";
import { agentStatuses } from "@/domain/task";

const meta = {
  title: "Tasks/Agent status",
  component: AgentStatus,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: { status: { control: "select", options: agentStatuses } },
  args: { status: "Running" },
} satisfies Meta<typeof AgentStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};
export const Paused: Story = { args: { status: "Paused" } };
export const Review: Story = { args: { status: "Review" } };
export const Blocked: Story = { args: { status: "Blocked" } };

export const Queued: Story = { args: { status: "Queued" } };
export const Complete: Story = { args: { status: "Complete" } };
export const Failed: Story = { args: { status: "Failed" } };
export const Interrupted: Story = { args: { status: "Interrupted" } };

export const Stopped: Story = { args: { status: "Stopped" } };
