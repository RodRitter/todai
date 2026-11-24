import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { TaskReferenceView } from "./task-reference-view";
const meta = {
  title: "Tasks/Task reference", component: TaskReferenceView,
  args: { workspaceName: "Workspace", task: { id: "task-one", title: "Recorded source", description: "A durable task reference.", status: "Done", agentStatus: "Complete", archivedAt: "2026-11-24T10:00:00Z", comments: [{ id: "evidence", taskId: "task-one", body: "Verified result. See [Task two](#task/task-two).", createdAt: "2026-11-24T09:00:00Z", authorName: "Agent" }] } },
} satisfies Meta<typeof TaskReferenceView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Archived: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Recorded source" })).toBeVisible();
    await expect(canvas.getByText(/Archived task/)).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Task two" })).toHaveAttribute("href", "/tasks/task-two");
    await expect(canvas.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
export const Narrow: Story = { decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
