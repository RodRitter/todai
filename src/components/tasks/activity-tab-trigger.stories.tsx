import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTabTrigger } from "./activity-tab-trigger";

const meta = {
  title: "Tasks/Activity tab",
  component: ActivityTabTrigger,
  parameters: { layout: "centered" },
  args: { value: "activity" },
  decorators: [(Story) => <Tabs defaultValue="detail"><TabsList><TabsTrigger value="detail">Detail</TabsTrigger><Story /></TabsList></Tabs>],
} satisfies Meta<typeof ActivityTabTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { agentStatus: "Complete" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("img")).not.toBeInTheDocument();
  },
};
export const Running: Story = {
  args: { agentStatus: "Running" },
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole("tab", { name: "Activity" });
    await expect(within(tab).getByRole("img", { name: "Agent running" })).toBeVisible();
  },
};
export const FeedbackRequired: Story = {
  args: { agentStatus: "Waiting", comments: [{ id: "feedback", taskId: "task", body: "Please review the proposal.", createdAt: "2026-11-20T10:00:00Z", feedbackStatus: "pending" }] },
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole("tab", { name: "Activity" });
    await expect(within(tab).getByRole("img", { name: "Feedback required" })).toBeVisible();
    await expect(within(tab).queryByRole("img", { name: "Agent running" })).not.toBeInTheDocument();
  },
};
export const FeedbackWhileRunning: Story = {
  args: { ...FeedbackRequired.args, agentStatus: "Running" },
  play: FeedbackRequired.play,
};
export const AnsweredFeedback: Story = {
  args: { agentStatus: "Complete", comments: FeedbackRequired.args!.comments!.map((comment) => ({ ...comment, feedbackStatus: "answered" })) },
  play: Idle.play,
};
