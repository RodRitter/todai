import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test";
import type { TaskComment } from "@/domain/task";
import { Button } from "@/components/ui/button";
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
    const feed = canvas.getByRole("list", { name: "Activity, oldest first" });
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
  return <TaskComments agents={commentAgents} comments={comments} onDeleteComment={async (id) => setComments((current) => current.filter((comment) => comment.id !== id))} />;
}

export const DeleteComment: Story = {
  render: () => <DeletionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const control = canvas.getByRole("button", { name: "Message actions" });
    await userEvent.hover(canvas.getByText("An outdated comment."));
    await userEvent.click(control);
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete message" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByText("An outdated comment.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Message actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete message" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).getByRole("button", { name: /^Delete$/ }));
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
    await expect(canvas.queryByRole("tablist")).not.toBeInTheDocument();
    const messages = canvas.getByRole("list", { name: "Activity, oldest first" });
    await expect(messages.children[0]).toHaveTextContent("Human");
    await expect(messages.children[1]).toHaveTextContent("Builder");
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
    await expect(canvas.getByRole("list", { name: "Activity, oldest first" })).toHaveTextContent("Second line");
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
    await expect(canvas.getAllByRole("button", { name: "Message actions" })).toHaveLength(2);
    await expect(canvas.getByRole("list", { name: "Activity, oldest first" }).children).toHaveLength(1);
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
    await userEvent.click(canvas.getByRole("button", { name: "Message actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete message" }));
    const modal = within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
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
    const buttons = within(thread).getAllByRole("button", { name: "Message actions" });
    await userEvent.click(buttons[0]);
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete message" }));
    const modal = within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
    await expect(modal.getByText("Delete this message and its 1 nested reply? Artifacts linked only to the deleted messages will also be deleted. This cannot be undone.")).toBeVisible();
    await userEvent.click(modal.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByText("Use the filter.")).toBeVisible();
  },
};

function DeletePendingFeedbackExample() {
  const [comments, setComments] = useState<TaskComment[]>([request]);
  return <TaskComments comments={comments} agentStatus={comments.length ? "Waiting" : "Stopped"}
    onAnswerFeedback={async () => {}}
    onDeleteComment={async (id) => setComments((current) => current.filter((comment) => comment.id !== id))} />;
}

export const DeletePendingFeedback: Story = {
  render: () => <DeletePendingFeedbackExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const control = canvas.getByRole("button", { name: "Message actions" });
    await expect(control).toBeEnabled();
    await userEvent.click(control);
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete message" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByLabelText("Your feedback")).toBeVisible();
    await userEvent.click(control);
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete message" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).getByRole("button", { name: "Delete" }));
    await expect(canvas.getByText("No activity yet. Send a message to get started.")).toBeVisible();
  },
};

function ThreadExample({ fail = false }: { fail?: boolean }) {
  const [comments, setComments] = useState<TaskComment[]>([
    { id: "main", taskId: "task", authorName: "Reviewer", body: "The implementation is ready. What do you think?", createdAt: "2026-11-20T10:00:00Z" },
    { id: "nested", taskId: "task", parentCommentId: "main", authorName: "Human", body: "Looks good. Please keep the **keyboard navigation** accessible.", createdAt: "2026-11-20T10:01:00Z" },
  ]);
  return <TaskComments agents={commentAgents} comments={comments} onDeleteComment={async (id) => setComments((items) => items.filter((item) => item.id !== id && item.parentCommentId !== id))}
    onPostComment={async (body, artifacts, parentCommentId) => {
      if (fail) throw new Error("Connection lost. Try again.");
      setComments((items) => [...items, { id: crypto.randomUUID(), taskId: "task", body, artifacts, parentCommentId, authorName: "Human", createdAt: new Date().toISOString() }]);
    }} />;
}
export const ReplyThread: Story = {
  render: () => <ThreadExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByLabelText("Your reply"));
    await expect(canvas.getByRole("button", { name: "Send reply" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Your reply"), "Ready to ship.");
    await userEvent.click(canvas.getByRole("button", { name: "Send reply" }));
    await expect(within(canvas.getByLabelText("Reply thread")).getByText("Ready to ship.")).toBeVisible();
    await expect(canvas.getByLabelText("Your reply")).toHaveValue("");
    await userEvent.type(canvas.getByLabelText("Your reply"), "One more reply.{Enter}");
    await expect(within(canvas.getByLabelText("Reply thread")).getByText("One more reply.")).toBeVisible();
    await expect(canvas.getByLabelText("Your reply")).toHaveValue("");
  },
};
export const ReplyTagging: Story = {
  render: () => <ThreadExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your reply" });
    await userEvent.type(editor, "@Rev");
    await expect(await canvas.findByRole("option", { name: /@Reviewer/ })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(editor.querySelector('a[href="#agent/reviewer"]')).toHaveTextContent("@Reviewer");
    await userEvent.type(editor, "please review this reply.");
    await userEvent.click(canvas.getByRole("button", { name: "Send reply" }));
    const thread = within(canvas.getByLabelText("Reply thread"));
    await expect(await thread.findByText("@Reviewer")).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Your reply" })).toHaveTextContent(/^$/);
  },
};
export const ReplyError: Story = {
  render: () => <ThreadExample fail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }));
    await userEvent.type(canvas.getByLabelText("Your reply"), "Keep this draft.");
    await userEvent.click(canvas.getByRole("button", { name: "Send reply" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Connection lost");
    await expect(canvas.getByLabelText("Your reply")).toHaveTextContent("Keep this draft.");
  },
};


export const CollapsibleReplyThread: Story = {
  render: () => <ThreadExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }));
    await userEvent.type(canvas.getByLabelText("Your reply"), "Keep this draft while collapsed.");
    await userEvent.click(canvas.getByRole("button", { name: "Collapse comment by Reviewer" }));
    await expect(canvas.getByLabelText("Your reply")).not.toBeVisible();
    const expand = canvas.getByRole("button", { name: "Expand comment by Reviewer" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    expand.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("Your reply")).toBeVisible();
    await expect(canvas.getByLabelText("Your reply")).toHaveTextContent("Keep this draft while collapsed.");
    await userEvent.click(canvas.getByRole("button", { name: "Collapse comment by Reviewer" }));
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }));
    await expect(canvas.getByLabelText("Your reply")).toBeVisible();
  },
};
export const NarrowReplyThread: Story = {
  render: () => <ThreadExample />,
  decorators: [(Story) => <div className="max-w-80"><Story /></div>],
};
export const DarkReplyThread: Story = {
  render: () => <ThreadExample />,
  decorators: [(Story) => <div className="dark bg-background text-foreground p-4"><Story /></div>],
};

export const CommentHeaderCards: Story = {
  args: {
    comments: [
      { id: "parent", taskId: "task", authorName: "Reviewer", body: "The implementation is ready for review.", createdAt: "2026-11-20T10:00:00Z" },
      { id: "reply-one", taskId: "task", parentCommentId: "parent", authorName: "Human", body: "Please preserve keyboard navigation.", createdAt: "2026-11-20T10:01:00Z" },
      { id: "reply-two", taskId: "task", parentCommentId: "parent", authorName: "Accessibility and interaction reviewer", body: "Confirmed. **Keyboard focus** stays visible and replies remain readable on narrow screens.", createdAt: "2026-11-20T10:02:00Z" },
    ],
    onDeleteComment: async () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const parent = canvas.getByText("The implementation is ready for review.");
    const older = canvas.getByText("Please preserve keyboard navigation.");
    const newer = canvas.getByText(/Confirmed\./);
    await expect(newer.getBoundingClientRect().top).toBeGreaterThan(older.getBoundingClientRect().top);
    await expect(older.getBoundingClientRect().top).toBeGreaterThan(parent.getBoundingClientRect().top);
    await userEvent.click(canvas.getByRole("button", { name: "Collapse comment by Reviewer" }));
    await expect(older).not.toBeVisible();
    await expect(parent).not.toBeVisible();
    await expect(canvas.getByText("2 replies")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Expand comment by Reviewer" }));
    await expect(newer).toBeVisible();
  },
};
export const NarrowCommentHeaderCards: Story = { ...CommentHeaderCards, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DarkCommentHeaderCards: Story = { ...CommentHeaderCards, globals: { theme: "dark" } };

export const PrivateChatActions: Story = {
  args: {
    taskId: "task", comments: [{ ...request, feedbackStatus: undefined },
      { id: "nested-private", taskId: "task", parentCommentId: request.id, authorName: "Human", body: "A reply without a chat action.", createdAt: "2026-11-20T10:01:00Z" }],
    onPostComment: async () => {}, onDeleteComment: async () => {}, onChat: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(canvas.getAllByRole("button", { name: "Chat" })).toHaveLength(1);
    const reply = canvas.getByRole("button", { name: "Reply" });
    await expect(reply.nextElementSibling).toBe(canvas.getByRole("button", { name: "Chat" }));
    await expect(canvas.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getAllByRole("button", { name: "Message actions" })[0]);
    await expect(await body.findByRole("menuitem", { name: "Copy message" })).toBeVisible();
    await expect(body.getByRole("menuitem", { name: "Delete message" })).toBeVisible();
    await expect(body.getByRole("menuitem", { name: "Copy comment reference" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getAllByRole("button", { name: "Message actions" })[0]).toHaveFocus();
  },
};
export const NarrowPrivateChatActions: Story = { ...PrivateChatActions, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DarkPrivateChatActions: Story = { ...PrivateChatActions, decorators: [(Story) => <div className="dark bg-background p-4 text-foreground"><Story /></div>] };
export const RunningCommentMenu: Story = {
  ...PrivateChatActions,
  args: { ...PrivateChatActions.args, agentStatus: "Running" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole("button", { name: "Reply" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Chat" })).toBeEnabled();
    await userEvent.click(canvas.getAllByRole("button", { name: "Message actions" })[0]);
    await expect(await body.findByRole("menuitem", { name: "Delete message" })).toHaveAttribute("data-disabled");
    await expect(body.getByRole("menuitem", { name: "Copy message" })).not.toHaveAttribute("data-disabled");
    await userEvent.keyboard("{Escape}");
  },
};

export const CopyCommentReference: Story = {
  ...PrivateChatActions,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clipboard = spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    try {
      await userEvent.click(canvas.getAllByRole("button", { name: "Message actions" })[0]);
      await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Copy comment reference" }));
      await expect(clipboard).toHaveBeenCalledWith("[Comment by Builder](#comment/task/request)");
    } finally { clipboard.mockRestore(); }
  },
};

export const EmptyComments: Story = {
  args: { comments: [], onPostComment: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Add the first comment" })).toBeVisible();
    await expect(canvas.getByText(/to choose an agent/)).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Your message" })).toBeVisible();
  },
};
export const EmptyCommentsNarrow: Story = { ...EmptyComments, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const EmptyCommentsDark: Story = { ...EmptyComments, globals: { theme: "dark" } };
export const EmptyCommentsQueued: Story = {
  args: { ...EmptyComments.args, agentStatus: "Queued" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("heading", { name: "Add the first comment" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Send message" })).toBeDisabled();
    await expect(canvas.getByText("The agent is queued to start.")).toBeVisible();
  },
};


function ResponseArrivalExample() {
  const [active, setActive] = useState(true);
  const [comments, setComments] = useState<TaskComment[]>([
    { id: "arrival-parent", taskId: "task", authorName: "Reviewer", body: "Review complete.", createdAt: "2026-11-20T10:00:00Z" },
    { id: "arrival-human", taskId: "task", parentCommentId: "arrival-parent", authorName: "Human", body: "Please explain.", createdAt: "2026-11-20T10:01:00Z" },
  ]);
  function add(authorName: string, nested = false) {
    setComments((items) => [...items, { id: `arrival-${items.length}`, taskId: "task", authorName,
      parentCommentId: nested ? "arrival-parent" : undefined,
      body: `${authorName} response ${items.length}`, createdAt: new Date().toISOString() }]);
  }
  return <>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => add("Reviewer")}>Finish response</Button>
      <Button onClick={() => add("Reviewer", true)}>Finish reply</Button>
      <Button onClick={() => add("Human")}>Add human comment</Button>
      <Button onClick={() => setActive((value) => !value)}>{active ? "Leave activity" : "Return to activity"}</Button>
    </div>
    <div hidden={!active}><TaskComments taskId="task" active={active} comments={comments} onPostComment={async () => {}} /></div>
  </>;
}

export const ResponseArrival: Story = {
  render: () => <ResponseArrivalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scroll = spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    try {
      await expect(scroll).not.toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("button", { name: "Collapse comment by Reviewer" }));
      await userEvent.click(canvas.getByRole("button", { name: "Finish reply" }));
      await expect(await canvas.findByText("Reviewer response 2")).toBeVisible();
      await expect(canvasElement.querySelector("#comment-arrival-2")).toHaveAttribute("data-attention", "true");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await expect(scroll).toHaveBeenCalledTimes(1);
      await userEvent.click(canvas.getByRole("button", { name: "Add human comment" }));
      await expect(scroll).toHaveBeenCalledTimes(1);
      await userEvent.click(canvas.getByRole("button", { name: "Leave activity" }));
      await userEvent.click(canvas.getByRole("button", { name: "Finish response" }));
      await userEvent.click(canvas.getByRole("button", { name: "Return to activity" }));
      await expect(scroll).toHaveBeenCalledTimes(1);
      await userEvent.click(canvas.getByRole("button", { name: "Finish response" }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await expect(scroll).toHaveBeenCalledTimes(2);
    } finally { scroll.mockRestore(); }
  },
};
export const NarrowResponseArrival: Story = { ...ResponseArrival, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DarkResponseArrival: Story = { ...ResponseArrival, globals: { theme: "dark" } };

export const ReplyTypingPreventsScroll: Story = {
  render: () => <ResponseArrivalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scroll = spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    try {
      const editor = canvas.getByRole("textbox", { name: "Your reply" });
      await userEvent.type(editor, "Keep this draft.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      scroll.mockClear();
      // Programmatic arrival keeps focus in the reply editor.
      canvas.getByRole("button", { name: "Finish response" }).click();
      await canvas.findByText("Reviewer response 2");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await expect(editor).toHaveFocus();
      await expect(scroll).not.toHaveBeenCalled();
      await expect(editor).toHaveTextContent("Keep this draft.");
      await userEvent.click(canvas.getByRole("button", { name: "Finish response" }));
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    } finally { scroll.mockRestore(); }
  },
};

export const FixedMainInput: Story = {
  args: {
    embedded: true,
    onPostComment: async () => {},
    comments: Array.from({ length: 20 }, (_, index) => ({
      id: `fixed-${index}`, taskId: "task", authorName: "Reviewer", body: `Activity message ${index}`,
      createdAt: new Date(Date.UTC(2026, 10, 20, 10, index)).toISOString(),
    })),
  },
  decorators: [(Story) => <div className="flex h-[600px] min-h-0 flex-col"><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Your message" });
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight));
    const top = input.getBoundingClientRect().top;
    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await expect(input).toBeVisible();
    await expect(input.getBoundingClientRect().top).toBe(top);
    await expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(viewport.getBoundingClientRect().bottom);
    await expect(input.closest('[data-slot="conversation-composer"]')).toHaveAttribute("data-variant", "fixed");
  },
};
export const FixedMainInputNarrow: Story = { ...FixedMainInput, decorators: [(Story) => <div className="flex h-[600px] max-w-80 min-h-0 flex-col"><Story /></div>] };
export const FixedMainInputDark: Story = { ...FixedMainInput, globals: { theme: "dark" } };

export const ReplyInputScrollsIntoView: Story = {
  ...FixedMainInput,
  args: {
    ...FixedMainInput.args,
    comments: [...FixedMainInput.args!.comments!, {
      id: "fixed-reply", parentCommentId: "fixed-19", taskId: "task", authorName: "Human",
      body: "Please check this comment.", createdAt: "2026-11-20T11:00:00Z",
    }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    viewport.scrollTop = viewport.scrollHeight;
    const input = canvas.getByRole("textbox", { name: "Your reply" });
    const surface = input.closest('[data-slot="input-group"]')!;
    const samples: number[] = [];
    const resize = new ResizeObserver(() => {
      samples.push(surface.getBoundingClientRect().bottom - viewport.getBoundingClientRect().bottom);
    });
    resize.observe(surface);
    try {
      await userEvent.click(input);
      await expect(canvas.getByRole("button", { name: "Send reply" })).toBeVisible();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await expect(samples.length).toBeGreaterThan(0);
      await expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    } finally { resize.disconnect(); }
    await waitFor(() => {
      expect(surface.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewport.getBoundingClientRect().bottom + 1);
      expect(surface.getBoundingClientRect().top).toBeGreaterThanOrEqual(viewport.getBoundingClientRect().top - 1);
    });
    await expect(input).toHaveFocus();
  },
};


const threadRoot: TaskComment = { id: "thread-root", taskId: "task", authorName: "Reviewer", body: "Review this change.", createdAt: "2026-11-20T10:00:00Z" };
function NestedFeedbackExample() {
  const [comments, setComments] = useState<TaskComment[]>([threadRoot,
    { ...threadRoot, id: "triggering-reply", parentCommentId: threadRoot.id, authorName: "Human", body: "Please make the change." },
    { ...request, parentCommentId: "triggering-reply" }]);
  return <TaskComments comments={comments} onAnswerFeedback={async (id, body) => {
    setComments((items) => [...items.map((item) => item.id === id ? { ...item, feedbackStatus: "answered" as const } : item),
      { id: "nested-answer", taskId: "task", parentCommentId: id, runId: "run", authorName: "Human", body, createdAt: "2026-11-20T11:00:00Z" }]);
  }} />;
}
export const NestedFeedback: Story = {
  render: () => <NestedFeedbackExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list", { name: "Activity, oldest first" });
    await expect(list.children).toHaveLength(1);
    const requestNode = canvas.getByRole("group", { name: "Feedback request" });
    await expect(requestNode.closest('[data-slot="message-group"][data-variant="reply"]')).not.toBeNull();
    await expect(requestNode.closest('[data-slot="message-replies"]')).toHaveAttribute("id", "thread-triggering-reply");
    await expect(getComputedStyle(requestNode).paddingLeft).toBe("0px");
    await expect(getComputedStyle(requestNode).borderTopWidth).toBe("0px");
    const mainContent = list.querySelector('[data-slot="message-content"]')!;
    await expect(getComputedStyle(mainContent, "::before").borderLeftWidth).toBe("0px");
    await userEvent.type(canvas.getByLabelText("Your feedback"), "Approved.");
    await userEvent.click(canvas.getByRole("button", { name: "Submit feedback" }));
    await expect(canvas.getByText("Your answer")).toBeVisible();
    await expect(canvas.getByText("Approved.")).toBeVisible();
    await expect(list.children).toHaveLength(1);
    await expect(canvas.getAllByLabelText("Reply thread")).toHaveLength(3);
  },
};
export const NarrowNestedFeedback: Story = { ...NestedFeedback, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DarkNestedFeedback: Story = { ...NestedFeedback, globals: { theme: "dark" } };
export const LongReplyPreview: Story = {
  args: { comments: [threadRoot,
    { ...threadRoot, id: "short-reply", parentCommentId: threadRoot.id, body: Array.from({ length: 10 }, (_, i) => `Short line ${i + 1}`).join("  \n") },
    { ...threadRoot, id: "long-reply", parentCommentId: threadRoot.id, body: Array.from({ length: 15 }, (_, i) => `Long line ${i + 1}`).join("  \n") },
  ] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reply = within(canvasElement.querySelector<HTMLElement>("#comment-long-reply")!);
    const toggle = reply.getByRole("button", { name: "Collapse comment by Reviewer" });
    const content = canvasElement.ownerDocument.getElementById(toggle.getAttribute("aria-controls")!)!;
    await expect(content).toHaveTextContent("Long line 15");
    await expect(canvas.queryByRole("button", { name: /Show full|Show less/ })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(content).not.toBeVisible();
    await expect(reply.queryByText("0 replies")).not.toBeInTheDocument();
    const root = within(canvasElement.querySelector<HTMLElement>("#comment-thread-root")!);
    await userEvent.click(root.getAllByRole("button", { name: "Collapse comment by Reviewer" })[0]);
    await expect(root.getByText("2 replies")).toBeVisible();
    await userEvent.click(root.getByRole("button", { name: "Expand comment by Reviewer" }));
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    toggle.focus();
    await userEvent.keyboard(" ");
    await expect(content).toBeVisible();
  },
};


export const LongRootPreview: Story = {
  args: { comments: [{ ...threadRoot, body: Array.from({ length: 15 }, (_, i) => `Root line ${i + 1}`).join("  \n") }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /Collapse comment by/ });
    const content = canvasElement.ownerDocument.getElementById(toggle.getAttribute("aria-controls")!)!;
    await expect(content).toHaveTextContent("Root line 15");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.queryByRole("button", { name: /Show full|Show less/ })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(content).not.toBeVisible();
    await expect(canvas.getByText("0 replies")).toBeVisible();
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    await expect(content).toBeVisible();
  },
};
export const LongRootFeedbackPreview: Story = {
  ...LongRootPreview,
  args: { comments: [{ ...request, body: LongRootPreview.args!.comments![0].body }], onAnswerFeedback: fn() },
  play: async (context) => {
    await LongRootPreview.play!(context);
    const canvas = within(context.canvasElement);
    await expect(canvas.getByLabelText("Your feedback")).toBeVisible();
    await userEvent.type(canvas.getByLabelText("Your feedback"), "Proceed.");
    await expect(canvas.getByRole("button", { name: "Submit feedback" })).toBeEnabled();
  },
};


export const StableReplyScroll: Story = {
  args: { embedded: true, comments: [
    ...Array.from({ length: 20 }, (_, index) => ({ ...threadRoot, id: `scroll-${index}`, body: index === 7 ? Array.from({ length: 20 }, (_, i) => `Root line ${i}`).join("  \n") : `Message ${index}`, createdAt: `2026-11-20T10:${String(index).padStart(2, "0")}:00Z` })),
    { ...threadRoot, id: "scroll-reply", parentCommentId: "scroll-8", body: Array.from({ length: 20 }, (_, i) => `Reply line ${i}`).join("  \n"), createdAt: "2026-11-20T10:08:01Z" },
  ] },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    await waitFor(() => expect(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop).toBeLessThan(2));
    const target = canvasElement.querySelector<HTMLElement>("#comment-scroll-8")!;
    viewport.scrollTop += target.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 40;
    const thread = within(target);
    for (const name of ["Collapse comment by Reviewer", "Expand comment by Reviewer"]) {
      const top = viewport.scrollTop;
      await userEvent.click(thread.getAllByRole("button", { name })[0]);
      await waitFor(() => {
        const running = viewport.getAnimations({ subtree: true }).filter((animation) =>
          animation instanceof CSSTransition ? animation.transitionProperty === "height" :
          animation instanceof CSSAnimation && animation.animationName.startsWith("collapse-"));
        expect(running.some((animation) => animation.playState === "running")).toBe(false);
      });
      await expect(Math.abs(viewport.scrollTop - top)).toBeLessThan(2);
    }
  },
  decorators: [(Story) => <div className="flex h-[600px] flex-col"><Story /></div>],
};


export const ReplyClosesWithoutFlicker: Story = {
  render: () => <ThreadExample />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Collapse comment by Reviewer" });
    const content = canvasElement.ownerDocument.getElementById(trigger.getAttribute("aria-controls")!)!;
    const heights: number[] = [];
    const started = performance.now();
    trigger.click();
    await new Promise<void>((resolve) => {
      function sample() {
        heights.push(content.getBoundingClientRect().height);
        if (performance.now() - started < 400) requestAnimationFrame(sample);
        else resolve();
      }
      requestAnimationFrame(sample);
    });
    for (let index = 1; index < heights.length; index++) {
      await expect(heights[index]).toBeLessThanOrEqual(heights[index - 1] + 1);
    }
    await expect(heights.at(-1)).toBe(0);
  },
};


export const BusyDiscussion: Story = {
  args: { comments: [
    { ...threadRoot, body: "The board changes are ready for review.\n\n- Keep completed tasks available through the filter.\n- Preserve keyboard navigation." },
    { ...threadRoot, id: "review-reply", parentCommentId: threadRoot.id, authorName: "Human", body: "Please keep the selected filter when I return to the board.", createdAt: "2026-11-20T10:01:00Z" },
    { ...threadRoot, id: "review-answer", parentCommentId: threadRoot.id, authorName: "Builder", body: "The selected filter now stays active. The keyboard checks passed.", createdAt: "2026-11-20T10:02:00Z" },
    { ...request, id: "next-decision", createdAt: "2026-11-20T10:03:00Z" },
    { ...threadRoot, id: "next-comment", body: "The remaining changes are ready for a separate review.", createdAt: "2026-11-20T10:04:00Z" },
  ] },
};
export const BusyDiscussionDark: Story = { ...BusyDiscussion, globals: { theme: "dark" } };
export const BusyDiscussionNarrow: Story = { ...BusyDiscussion, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };


export const ReplyGutter: Story = {
  render: () => <ThreadExample />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "Your reply" });
    const thread = canvasElement.querySelector('[data-slot="message-replies"]')!;
    const header = canvasElement.querySelector('[data-slot="message-header"]')!;
    const content = canvasElement.querySelector('[data-slot="message-content"]')!;
    await expect(header.querySelector('[data-slot="message-avatar"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-slot="message-thread-card"]')).toBeNull();
    const comments = content.querySelector('[data-slot="message-comments"]')!;
    const gutter = getComputedStyle(thread, "::before");
    await expect(gutter.top).toBe("16px");
    await expect(gutter.bottom).toBe("0px");
    await expect(getComputedStyle(comments, "::before").content).toBe("none");
    await expect(gutter.borderLeftWidth).toBe("1px");
    await expect(gutter.borderTopWidth).toBe("1px");
    await expect(gutter.borderTopLeftRadius).toBe("8px");
    await expect(comments.contains(input)).toBe(false);
    await expect(comments.getBoundingClientRect().bottom).toBeLessThanOrEqual(input.getBoundingClientRect().top);
    await expect(gutter.borderLeftColor).toBe(getComputedStyle(header.parentElement!).backgroundColor);
    await expect(getComputedStyle(thread).borderLeftWidth).toBe("0px");
    await expect(thread.getBoundingClientRect().left).toBe(content.getBoundingClientRect().left + parseFloat(getComputedStyle(content).paddingLeft));
    await expect(input.closest('[data-slot="message-reply-composer"]')!.getBoundingClientRect().left).toBe(thread.getBoundingClientRect().left);
    await expect(thread.contains(input)).toBe(false);
    await expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(thread.getBoundingClientRect().bottom);
    const composer = input.closest('[data-slot="message-reply-composer"]')!;
    const curve = getComputedStyle(composer, "::before");
    await expect(curve.borderLeftWidth).toBe("1px");
    await expect(curve.borderBottomWidth).toBe("1px");
    await expect(curve.borderBottomLeftRadius).toBe("8px");
    await expect(curve.borderLeftColor).toBe(gutter.borderLeftColor);
    await expect(composer.getBoundingClientRect().top + parseFloat(curve.top)).toBe(thread.getBoundingClientRect().bottom);
  },
};
export const ReplyGutterDark: Story = { ...ReplyGutter, globals: { theme: "dark" } };
export const ReplyGutterNarrow: Story = { ...ReplyGutter, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };


export const CollapsedDiscussion: Story = {
  ...BusyDiscussion,
  play: async ({ canvasElement }) => {
    const root = within(canvasElement.querySelector<HTMLElement>("#comment-thread-root")!);
    await userEvent.click(root.getAllByRole("button", { name: "Collapse comment by Reviewer" })[0]);
    await expect(root.getByText("2 replies")).toBeVisible();
    await expect(root.getByRole("button", { name: "Expand comment by Reviewer" })).toHaveAttribute("aria-expanded", "false");
  },
};
export const CollapsedDiscussionDark: Story = { ...CollapsedDiscussion, globals: { theme: "dark" } };
export const CollapsedDiscussionNarrow: Story = { ...CollapsedDiscussion, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };


export const InputCollapseKeepsScroll: Story = {
  ...StableReplyScroll,
  args: { ...StableReplyScroll.args, onPostComment: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const target = canvasElement.querySelector<HTMLElement>("#comment-scroll-8")!;
    for (const editor of [within(target).getByRole("textbox", { name: "Your reply" }), canvas.getByRole("textbox", { name: "Your message" })]) {
      editor.focus();
      await expect(editor).toHaveFocus();
      await new Promise((resolve) => setTimeout(resolve, 500));
      viewport.scrollTo({ top: 200, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const top = viewport.scrollTop;
      editor.blur();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await expect(Math.abs(viewport.scrollTop - top)).toBeLessThan(2);
    }
  },
};

export const NamedHuman: Story = {
  args: { comments: [{ id: "named", taskId: "task", authorName: "Roderick", authorRole: "human", body: "Please review the changes.", createdAt: "2026-11-17T10:00:00Z" }] },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="message-group"][data-variant="comment"]');
    await expect(root).toHaveClass("bg-transparent");
  },
};

const approvalRequest: TaskComment = {
  ...request, responseType: "approval", body: "Approve the proposed change?",
  recommendation: "Approve the change to hide archived tasks by default.",
};
export const ApproveFeedback: Story = {
  args: { comments: [approvalRequest], onAnswerFeedback: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(args.onAnswerFeedback).toHaveBeenCalledWith("request", "Approved");
  },
};
export const RejectFeedback: Story = {
  args: { comments: [approvalRequest], onAnswerFeedback: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Reject" }));
    await expect(args.onAnswerFeedback).toHaveBeenCalledWith("request", "Rejected");
  },
};
export const ApprovalPending: Story = {
  args: { comments: [approvalRequest], onAnswerFeedback: () => new Promise<void>(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(canvas.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Reject" })).toBeDisabled();
  },
};
export const ApprovalError: Story = {
  args: { comments: [approvalRequest], onAnswerFeedback: async () => { throw new Error("Could not save the answer. Try again."); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reject" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Could not save the answer.");
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeEnabled();
  },
};
export const ApprovalDark: Story = { args: ApproveFeedback.args, globals: { theme: "dark" } };
export const ApprovalNarrow: Story = { args: ApproveFeedback.args, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };

export const HeaderCardActions: Story = {
  args: { comments: [request], onPostComment: fn(), onChat: fn() },
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>('[data-slot="message-header"]')!;
    const toggle = within(header).getByRole("button", { name: /Collapse comment by/ });
    await expect(within(header).getByText("Feedback")).toBeVisible();
    await expect(header.querySelector('[data-slot="message-avatar"]')).toBeNull();
    await userEvent.click(within(header).getByRole("button", { name: "Message actions" }));
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(within(header).getByText("Feedback")).toBeVisible();
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const bounds = header.getBoundingClientRect();
    const triggerBounds = toggle.getBoundingClientRect();
    await expect(triggerBounds.width).toBe(bounds.width);
    await expect(triggerBounds.height).toBe(bounds.height);
  },
};
export const HeaderCardActionsNarrow: Story = { ...HeaderCardActions, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const HeaderCardActionsDark: Story = { ...HeaderCardActions, globals: { theme: "dark" } };

export const ReplyGutterJunctions: Story = {
  ...BusyDiscussion,
  play: async ({ canvasElement }) => {
    const thread = canvasElement.querySelector('[data-slot="message-replies"]')!;
    const replies = thread.querySelectorAll(':scope > [data-variant="reply"]');
    await expect(replies.length).toBeGreaterThan(1);
    const rootHeader = canvasElement.querySelector('[data-slot="message-header"]')!;
    const replyHeader = replies[0].querySelector('[data-slot="message-header"]')!;
    await expect(parseFloat(getComputedStyle(replyHeader).paddingTop)).toBeLessThan(parseFloat(getComputedStyle(rootHeader).paddingTop));
    await expect(replyHeader.getBoundingClientRect().height).toBeLessThan(rootHeader.getBoundingClientRect().height);
    await expect(getComputedStyle(replies[0], "::before").content).toBe("none");
    for (const reply of Array.from(replies).slice(1)) {
      const branch = getComputedStyle(reply, "::before");
      const header = reply.querySelector('[data-slot="card"]')!;
      await expect(branch.height).toBe("1px");
      await expect(branch.width).toBe("8px");
      await expect(branch.left).toBe("-8px");
      await expect(branch.backgroundColor).toBe(getComputedStyle(header).backgroundColor);
      const branchTop = reply.getBoundingClientRect().top + parseFloat(branch.top);
      await expect(branchTop).toBeGreaterThan(header.getBoundingClientRect().top);
      await expect(branchTop).toBeLessThan(header.getBoundingClientRect().bottom);
    }
  },
};
export const ReplyGutterJunctionsDark: Story = { ...ReplyGutterJunctions, globals: { theme: "dark" } };
export const ReplyGutterJunctionsNarrow: Story = { ...ReplyGutterJunctions, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };

export const CompactRootComments: Story = {
  args: { comments: [
    { ...threadRoot, id: "compact-root-1", body: "The changes are ready for review." },
    { ...threadRoot, id: "compact-root-2", authorName: "Human", body: "The spacing looks correct.", createdAt: "2026-11-20T10:01:00Z" },
    { ...threadRoot, id: "compact-root-3", body: "I will continue with the next task.", createdAt: "2026-11-20T10:02:00Z" },
  ] },
};
