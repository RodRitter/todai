import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, spyOn, userEvent, within } from "storybook/test";
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
    await expect(canvas.getAllByRole("button", { name: "Message actions" })).toHaveLength(2);
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
    await expect(canvas.getByLabelText("Your reply")).toHaveValue("Keep this draft.");
  },
};


export const CollapsibleReplyThread: Story = {
  render: () => <ThreadExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }));
    await userEvent.type(canvas.getByLabelText("Your reply"), "Keep this draft while collapsed.");
    await userEvent.click(canvas.getByRole("button", { name: "Collapse 1 reply" }));
    await expect(canvas.getByLabelText("Your reply")).not.toBeVisible();
    const expand = canvas.getByRole("button", { name: "Expand 1 reply" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    expand.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("Your reply")).toBeVisible();
    await expect(canvas.getByLabelText("Your reply")).toHaveValue("Keep this draft while collapsed.");
    await userEvent.click(canvas.getByRole("button", { name: "Collapse 1 reply" }));
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

export const ConnectedAvatars: Story = {
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
    await expect(newer.getBoundingClientRect().top).toBeLessThan(older.getBoundingClientRect().top);
    await expect(older.getBoundingClientRect().top).toBeLessThan(parent.getBoundingClientRect().top);
    await userEvent.click(canvas.getByRole("button", { name: "Collapse 2 replies" }));
    await expect(older).not.toBeVisible();
    await expect(parent).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Expand 2 replies" }));
    await expect(newer).toBeVisible();
  },
};
export const NarrowConnectedAvatars: Story = { ...ConnectedAvatars, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const DarkConnectedAvatars: Story = { ...ConnectedAvatars, decorators: [(Story) => <div className="dark bg-background text-foreground p-4"><Story /></div>] };

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
    <div hidden={!active}><TaskComments taskId="task" active={active} comments={comments} /></div>
  </>;
}

export const ResponseArrival: Story = {
  render: () => <ResponseArrivalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scroll = spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    try {
      await expect(scroll).not.toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("button", { name: "Collapse 1 reply" }));
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
