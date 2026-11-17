import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { TaskComment } from "@/domain/task";
import { TaskComments } from "./task-comments";

const request: TaskComment = {
  id: "request", taskId: "task", runId: "run", authorName: "Builder",
  body: "Should archived tasks remain visible on the board?",
  recommendation: "Hide archived tasks by default and offer a filter to show them.",
  feedbackStatus: "pending", createdAt: "2026-11-17T10:00:00Z",
};

function FeedbackExample() {
  const [comments, setComments] = useState([request]);
  return <TaskComments comments={comments} onAnswerFeedback={async (_, body) => {
    setComments([{ ...request, feedbackStatus: "answered" }, {
      id: "reply", taskId: "task", runId: "run", authorName: "Human",
      body, createdAt: "2026-11-17T10:01:00Z",
    }]);
  }} />;
}

const meta = {
  title: "Tasks/Task comments",
  component: TaskComments,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TaskComments>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = { render: () => <FeedbackExample /> };
export const Running: Story = { args: { agentStatus: "Running", comments: [] } };
export const RunningWithHistory: Story = {
  args: {
    agentStatus: "Running",
    comments: [{ id: "previous", taskId: "task", authorName: "Human", body: "Please review the changes.", createdAt: "2026-11-17T10:00:00Z" }],
  },
};
export const SubmitFeedback: Story = {
  render: () => <FeedbackExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Submit feedback" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Your feedback"), "Yes, use the filter.");
    await userEvent.click(canvas.getByRole("button", { name: "Submit feedback" }));
    await expect(canvas.getByText("Human")).toBeVisible();
    await expect(canvas.getByText("Yes, use the filter.")).toBeVisible();
    await expect(canvas.getByText(request.body)).toBeVisible();
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
  },
};
export const Cancelled: Story = { args: { comments: [{ ...request, feedbackStatus: "cancelled" }] } };
export const FailedSubmission: Story = {
  args: { comments: [request], onAnswerFeedback: async () => { throw new Error("Connection lost. Try again."); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Your feedback"), "Keep this reply.");
    await userEvent.click(canvas.getByRole("button", { name: "Submit feedback" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Connection lost");
    await expect(canvas.getByLabelText("Your feedback")).toHaveValue("Keep this reply.");
  },
};

const commentAgents = ["Refiner", "Implementor", "Reviewer"].map((name) => ({
  id: name.toLowerCase(), name, tool: "codex" as const, model: "test-model", effort: "medium" as const,
  permissions: "workspace-write" as const, instructions: `Work as ${name}.`,
}));
function CommentExample() {
  const [comments, setComments] = useState<TaskComment[]>([]);
  return <TaskComments agents={commentAgents} comments={comments} onPostComment={async (body, artifacts) => {
    setComments((current) => [...current, { id: crypto.randomUUID(), taskId: "task", body, artifacts, authorName: "Human", createdAt: new Date().toISOString() }]);
  }} />;
}
export const HumanComment: Story = {
  render: () => <CommentExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Post comment" })).toBeDisabled();
    const editor = await canvas.findByRole("textbox", { name: "Your comment" });
    await userEvent.click(editor);
    await userEvent.type(editor, "@Rev");
    await userEvent.click(await canvas.findByRole("option", { name: /@Reviewer/ }));
    await userEvent.type(editor, "please review this.");
    await userEvent.click(canvas.getByRole("button", { name: "Post comment" }));
    await expect(await canvas.findByText("Human")).toBeVisible();
    await expect(canvas.getByText("@Reviewer")).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Your comment" })).toHaveTextContent("");
  },
};
export const FailedComment: Story = {
  args: { agents: commentAgents, onPostComment: async () => { throw new Error("Connection lost. Try again."); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your comment" });
    await userEvent.type(editor, "Keep this comment.");
    await userEvent.click(canvas.getByRole("button", { name: "Post comment" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Connection lost");
    await expect(editor).toHaveTextContent("Keep this comment.");
  },
};
