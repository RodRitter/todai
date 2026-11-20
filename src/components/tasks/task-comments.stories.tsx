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
  title: "Tasks/Activity",
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
    await expect(canvas.getByText("Your answer")).toBeVisible();
    await expect(canvas.getByText("Feedback received")).toBeVisible();
    await expect(canvas.getByText("Yes, use the filter.")).toBeVisible();
    await expect(canvas.getByText(request.body)).toBeVisible();
    const feed = canvas.getByRole("list", { name: "Activity, newest first" });
    await expect(feed.children).toHaveLength(1);
    await expect(within(feed.children[0] as HTMLElement).getByText("Yes, use the filter.")).toBeVisible();
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
    const editor = await canvas.findByRole("textbox", { name: "Your message" });
    await userEvent.click(editor);
    await expect(canvas.getByRole("button", { name: "Send message" })).toBeDisabled();
    await userEvent.type(editor, "@Rev");
    await userEvent.click(await canvas.findByRole("option", { name: /@Reviewer/ }));
    await userEvent.type(editor, "please review this.");
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(await canvas.findByText("Human")).toBeVisible();
    await expect(canvas.getByText("@Reviewer")).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Your message" })).toHaveTextContent("");
  },
};
export const FailedComment: Story = {
  args: { agents: commentAgents, onPostComment: async () => { throw new Error("Connection lost. Try again."); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your message" });
    await userEvent.type(editor, "Keep this comment.");
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Connection lost");
    await expect(editor).toHaveTextContent("Keep this comment.");
  },
};

function DeletionExample() {
  const [comments, setComments] = useState<TaskComment[]>([
    { id: "delete-me", taskId: "task", authorName: "Human", body: "An outdated comment.", createdAt: "2026-11-17T10:00:00Z" },
  ]);
  return <TaskComments comments={comments} onDeleteComment={async (id) => setComments((current) => current.filter((comment) => comment.id !== id))} />;
}

export const DeleteComment: Story = {
  render: () => <DeletionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const control = canvas.getByRole("button", { name: "Delete message" });
    await userEvent.hover(canvas.getByText("An outdated comment."));
    await userEvent.click(control);
    await userEvent.click(within(await body.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByText("An outdated comment.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Delete message" }));
    await userEvent.click(within(await body.findByRole("alertdialog")).getByRole("button", { name: /^Delete$/ }));
    await expect(canvas.getByText("No activity yet. Send a message to get started.")).toBeVisible();
  },
};

export const Handovers: Story = {
  args: { comments: [
    { id: "handover", taskId: "task", authorName: "Builder", body: "Implemented the artifact preview.\n\n- Pinned revisions remain accessible.\n- Keyboard navigation and narrow layouts are supported.\n\nReady for review.", createdAt: "2026-11-18T10:00:00Z" },
    { id: "human", taskId: "task", authorName: "Human", body: "Keep the task discussion simple and make the saved artifacts easier to inspect.", createdAt: "2026-11-18T09:00:00Z" },
  ] },
};
export const NarrowHandovers: Story = { ...Handovers, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };

export const Chat: Story = {
  args: { ...Handovers.args, agents: commentAgents, onPostComment: async () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "Activity" })).toBeVisible();
    const messages = canvas.getByRole("list", { name: "Activity, newest first" });
    await expect(messages.children[0]).toHaveTextContent("Builder");
    await expect(messages.children[1]).toHaveTextContent("Human");
    await expect(canvas.queryByRole("button", { name: "Run history" })).not.toBeInTheDocument();
  },
};
export const NarrowChat: Story = { ...Chat, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const Queued: Story = { args: { agentStatus: "Queued", onPostComment: async () => {} } };
export const LongMessage: Story = { args: { comments: [{ ...request, feedbackStatus: undefined, body: "## Findings\n\n" + "A detailed update remains fully readable in the activity feed.\n\n".repeat(20) }] } };
export const KeyboardSend: Story = {
  render: () => <CommentExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole("textbox", { name: "Your message" }), "First line{shift>}{enter}{/shift}Second line{enter}");
    await expect(await canvas.findByText("Human")).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Activity, newest first" })).toHaveTextContent("Second line");
    await expect(canvas.getByRole("textbox", { name: "Your message" })).toHaveTextContent("");
  },
};

export const DarkChat: Story = { ...Chat, decorators: [(Story) => <div className="dark bg-background text-foreground p-4"><Story /></div>] };

export const AnsweredFeedback: Story = {
  args: { comments: [
    { ...request, feedbackStatus: "answered" },
    { id: "answer", taskId: "task", runId: "run", authorName: "Human", body: "Yes, hide them by default.", createdAt: "2026-11-17T10:01:00Z" },
  ] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Your answer")).toBeVisible();
    await expect(canvas.getByText("Yes, hide them by default.")).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: "Copy message" })).toHaveLength(1);
    await expect(canvas.getByRole("list", { name: "Activity, newest first" }).children).toHaveLength(1);
  },
};
export const NarrowAnsweredFeedback: Story = { ...AnsweredFeedback, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DetailedAnswer: Story = { args: { comments: [
  { ...request, feedbackStatus: "answered" },
  { id: "answer", taskId: "task", runId: "run", authorName: "Human", body: "Yes, with these conditions:\n\n- Hide archived tasks by default.\n- Keep the filter accessible by keyboard.\n- Preserve the selected filter when navigating back.", createdAt: "2026-11-17T10:01:00Z" },
] } };

export const NarrowConfirmation: Story = { ...Waiting, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DarkConfirmation: Story = { ...Waiting, decorators: [(Story) => <div className="dark bg-background p-4 text-foreground"><Story /></div>] };
export const ConfirmationWithoutRecommendation: Story = { args: { comments: [{ ...request, recommendation: undefined }], onAnswerFeedback: async () => {} } };


export const FailedDeletion: Story = {
  args: {
    comments: [{ id: "message", taskId: "task", authorName: "Human", body: "Keep this message.", createdAt: "2026-11-17T10:00:00Z" }],
    onDeleteComment: async () => { throw new Error("Could not delete message. Try again."); },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Delete message" }));
    const modal = within(await body.findByRole("alertdialog"));
    await userEvent.click(modal.getByRole("button", { name: "Delete" }));
    await expect(await modal.findByRole("alert")).toHaveTextContent("Could not delete message.");
    await expect(modal.getByRole("button", { name: "Delete" })).toBeEnabled();
    await userEvent.click(modal.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByText("Keep this message.")).toBeVisible();
  },
};


export const SendingFeedback: Story = {
  args: { comments: [request], onAnswerFeedback: () => new Promise<void>(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Your feedback"), "Use the suggested filter.");
    await userEvent.click(canvas.getByRole("button", { name: "Submit feedback" }));
    await expect(canvas.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    await expect(canvas.getByLabelText("Your feedback")).toBeDisabled();
  },
};
export const LongFeedback: Story = {
  args: {
    comments: [{ ...request, body: "Should archived tasks remain visible in every board column, or should we show them only when someone enables the archive filter?", recommendation: "Hide archived tasks by default. Keep the archive filter available so people can find completed work without cluttering the board." }],
    onAnswerFeedback: async () => {},
  },
  decorators: [(Story) => <div className="max-w-80"><Story /></div>],
};


export const DeleteFeedbackThread: Story = {
  args: {
    comments: [
      { ...request, feedbackStatus: "answered" },
      { id: "answer", taskId: "task", runId: "run", authorName: "Human", body: "Use the filter.", createdAt: "2026-11-17T10:01:00Z" },
    ],
    onDeleteComment: async () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const thread = canvasElement.querySelector("#comment-request") as HTMLElement;
    const buttons = within(thread).getAllByRole("button", { name: "Delete message" });
    await userEvent.click(buttons[buttons.length - 1]);
    const modal = within(await body.findByRole("alertdialog"));
    await expect(modal.getByText("Delete this message and its 1 nested reply? This cannot be undone.")).toBeVisible();
    await userEvent.click(modal.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByText("Use the filter.")).toBeVisible();
  },
};
