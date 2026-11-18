import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { TaskEditor, type TaskEditorProps } from "./task-editor";
import { exampleTasks } from "./task.fixtures";

function EditorExample(args: TaskEditorProps) {
  const [open, setOpen] = useState(args.open);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {args.task ? "Edit task" : "New task"}
      </Button>
      <TaskEditor
        {...args}
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          args.onOpenChange(value);
        }}
      />
    </>
  );
}

const meta = {
  title: "Tasks/Task editor",
  component: TaskEditor,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  beforeEach: (context) => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/tasks/run") return Response.json([]);
      if (url.pathname === "/api/artifacts/links") return Response.json(context.parameters.artifactLinks ?? []);
      if (url.pathname === "/api/artifacts" && url.searchParams.has("id")) {
        const links = context.parameters.artifactLinks ?? [];
        const link = links.find((item: { artifact: { id: string } }) => item.artifact.id === url.searchParams.get("id"));
        if (link) return Response.json(link.artifact);
      }
      if (url.pathname === "/api/artifacts/download") return new Response("Evidence for the launch decision.");
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  render: (args) => <EditorExample {...args} />,
  args: { open: false, onOpenChange: fn(), onSave: fn(), onDelete: fn() },
} satisfies Meta<typeof TaskEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};
export const Edit: Story = { args: { task: exampleTasks[2] } };
export const EditWithoutDelete: Story = {
  args: { task: exampleTasks[2], onDelete: undefined },
};
export const OpenCreate: Story = {
  args: { open: true },
  parameters: { docs: { disable: true } },
};
export const OpenEdit: Story = {
  args: { open: true, task: exampleTasks[2] },
  parameters: { docs: { disable: true } },
};
export const SaveNewTask: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "New task" }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await expect(dialog.queryByLabelText("Assignee")).not.toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText("Title"), "Review the changes");
    await expect(
      dialog.getByRole("textbox", { name: "Description" }),
    ).toBeVisible();
    await expect(
      dialog.queryByRole("button", { name: "Edit description" }),
    ).not.toBeInTheDocument();
    await expect(
      dialog.queryByRole("button", { name: "Save description" }),
    ).not.toBeInTheDocument();
    await expect(
      dialog.queryByRole("button", { name: "Cancel description edit" }),
    ).not.toBeInTheDocument();
    await userEvent.type(
      dialog.getByLabelText("Description"),
      "**Review** the implementation.",
    );
    await userEvent.selectOptions(dialog.getByLabelText("Status"), "In review");
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Review the changes",
        status: "In review",
        description: "**Review** the implementation.",
      }),
    );
  },
};
export const InvalidTitle: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "New task" }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.type(dialog.getByLabelText("Title"), "   ");
    await expect(
      dialog.getByRole("button", { name: "Create task" }),
    ).toBeDisabled();
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

export const PersistedComments: Story = {
  args: {
    open: true,
    task: {
      ...exampleTasks[0],
      comments: [
        {
          id: "comment-1",
          taskId: exampleTasks[0].id,
          authorName: "Builder",
          body: "Implemented the task board.\n\nThe board now persists tasks and keeps their column placement after a restart.",
          createdAt: "2026-11-16T10:00:00Z",
        },
        {
          id: "comment-2",
          taskId: exampleTasks[0].id,
          authorName: "Reviewer",
          body: "Verified persistence.",
          createdAt: "2026-11-16T11:00:00Z",
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await waitFor(() =>
      expect(dialog.getByText(/Implemented the task board/)).toBeVisible(),
    );
    await expect(within(dialog.getByRole("tabpanel", { name: "Activity" })).getByText("Verified persistence.")).toBeVisible();
    await expect(dialog.getByText("Builder")).toBeVisible();
    await expect(within(dialog.getByRole("tabpanel", { name: "Activity" })).getByText("Reviewer")).toBeVisible();
  },
};
export const FailedSave: Story = {
  args: {
    open: true,
    task: exampleTasks[0],
    onSave: fn(async () => {
      throw new Error("Storage unavailable");
    }),
  },
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Edit title" }));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Unsaved draft");
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          "Could not confirm changes were saved. Try again to save your draft.",
        ),
      ).toBeVisible(),
    );
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Unsaved draft");
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole("button", {
        name: "Dismiss notification",
      }),
    );
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Unsaved draft");
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByText(
          "Could not confirm changes were saved. Try again to save your draft.",
        ),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await within(canvasElement.ownerDocument.body).findByText(
      "Could not confirm changes were saved. Try again to save your draft.",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByText(
          "Could not confirm changes were saved. Try again to save your draft.",
        ),
      ).not.toBeInTheDocument(),
    );
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Unsaved draft");
  },
};

export const RetryUnconfirmedCreate: Story = {
  args: { open: true, onSave: fn() },
  play: async ({ canvasElement, args }) => {
    args.onSave
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue(undefined);
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.type(dialog.getByLabelText("Title"), "Retry safely");
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await within(canvasElement.ownerDocument.body).findByText(
      "Could not confirm changes were saved. Try again to save your draft.",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await expect(args.onSave).toHaveBeenCalledTimes(2);
    await expect(args.onSave.mock.calls[0][0].id).toBe(
      args.onSave.mock.calls[1][0].id,
    );
  },
};

export const CancelUnconfirmedCreate: Story = {
  args: { open: true, onSave: fn() },
  play: async ({ canvasElement, args }) => {
    args.onSave
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue(undefined);
    const body = within(canvasElement.ownerDocument.body);
    let dialog = within(await body.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Title"), "Abandoned draft");
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await within(canvasElement.ownerDocument.body).findByText(
      "Could not confirm changes were saved. Try again to save your draft.",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "New task" }),
    );
    dialog = within(await body.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Title"), "Different task");
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await expect(args.onSave).toHaveBeenCalledTimes(2);
    await expect(args.onSave.mock.calls[0][0].id).not.toBe(
      args.onSave.mock.calls[1][0].id,
    );
  },
};

export const LegacyComment: Story = {
  args: {
    open: true,
    task: {
      ...exampleTasks[2],
      comments: [
        {
          id: "legacy",
          taskId: exampleTasks[2].id,
          body: "An earlier update without saved author information.",
          createdAt: "2026-11-16T09:00:00Z",
        },
      ],
    },
  },
};

export const MarkdownContent: Story = {
  args: {
    open: true,
    task: {
      ...exampleTasks[2],
      description:
        "## Requirements\n\n- **Keep** task history\n- Support `Markdown`",
      comments: [
        {
          id: "markdown",
          taskId: exampleTasks[2].id,
          authorName: "Interpreter",
          body: "### Handover\n\n**Completed** the review.\n\n```sh\nnpm test\n```",
          createdAt: "2026-11-16T12:00:00Z",
        },
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() => expect(
      dialog.getByRole("heading", { name: "Requirements" }),
    ).toBeVisible());
    await expect(
      dialog.getByRole("heading", { name: "Handover" }),
    ).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: "Edit description" }),
    );
    await expect(dialog.getByLabelText("Description")).toHaveTextContent("Requirements");
    await userEvent.clear(dialog.getByLabelText("Description"));
    await userEvent.type(
      dialog.getByLabelText("Description"),
      "Updated requirements",
    );
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(
      dialog.queryByRole("button", { name: "Save description" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      dialog.getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() =>
      expect(
        dialog.getByText("Updated requirements"),
      ).toBeVisible(),
    );
    await expect(
      dialog.queryByRole("textbox", { name: "Description" }),
    ).not.toBeInTheDocument();
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Updated requirements",
      }),
    );
    await expect(
      dialog.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
  },
};

export const CancelDescriptionEdit: Story = {
  args: {
    open: true,
    task: { ...exampleTasks[2], description: "**Original description**" },
  },
  play: async ({ canvasElement, args }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const preview = dialog.getByRole("button", { name: "Edit description" });
    preview.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.clear(dialog.getByLabelText("Description"));
    await userEvent.type(
      dialog.getByLabelText("Description"),
      "Discard this draft",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel" }),
    );
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

export const FailedDescriptionSave: Story = {
  args: { open: true, task: exampleTasks[2], onSave: fn() },
  play: async ({ canvasElement, args }) => {
    args.onSave
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValue(undefined);
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Edit description" }),
    );
    await userEvent.clear(dialog.getByLabelText("Description"));
    await userEvent.type(
      dialog.getByLabelText("Description"),
      "Retained draft",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Save changes" }),
    );
    await within(canvasElement.ownerDocument.body).findByText(
      "Could not confirm changes were saved. Try again to save your draft.",
    );
    await expect(dialog.getByLabelText("Description")).toHaveTextContent(
      "Retained draft",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() =>
      expect(dialog.getByText("Retained draft")).toBeVisible(),
    );
    await expect(
      dialog.queryByRole("textbox", { name: "Description" }),
    ).not.toBeInTheDocument();
  },
};

export const RedirectRunningTask: Story = {
  args: {
    open: true,
    onPostComment: fn(),
    task: { ...exampleTasks[0], status: "In progress", agentStatus: "Running" },
  },
};

export const RedirectQueuedTask: Story = {
  args: {
    open: true,
    onPostComment: fn(),
    task: { ...exampleTasks[0], status: "In review", agentStatus: "Queued" },
  },
};

export const InlineTitle: Story = {
  args: { open: true, task: exampleTasks[2] },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Edit title" }));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Updated title{Enter}");
    await expect(dialog.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Updated title");
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated title" }));
  },
};

const evidence = Array.from({ length: 18 }, (_, index) => ({
  artifact: {
    id: `launch-evidence-${index}`, revisionId: `revision-${index}`, revisionNumber: 1,
    workspaceId: "workspace", archived: false, title: `Launch evidence ${index + 1}: accessibility and persistence review`,
    description: "Review evidence", type: "text", creator: "Reviewer",
    createdAt: "2026-11-18T10:00:00Z", updatedAt: "2026-11-18T10:00:00Z",
    filename: "evidence.txt", mediaType: "text/plain", byteSize: 33, url: null,
  }, explicit: true, comments: [],
}));
const decision = {
  id: "launch-decision", taskId: exampleTasks[0].id, authorName: "Reviewer",
  createdAt: "2026-11-18T10:00:00Z", feedbackStatus: "pending" as const,
  body: "## Ready for a limited launch?\n\nPersistence and keyboard navigation passed. The migration still needs a production-sized rehearsal. Please choose whether to launch to the pilot group or wait for that rehearsal.",
  recommendation: "Start with the pilot group, keep a database backup, and schedule the migration rehearsal before opening access to everyone.",
  artifacts: [{ artifactId: evidence[0].artifact.id, revisionId: evidence[0].artifact.revisionId }],
};

export const PendingDecision: Story = {
  args: { open: true, task: { ...exampleTasks[0], agentStatus: "Waiting", comments: [decision] }, onAnswerFeedback: fn() },
  parameters: { artifactLinks: evidence },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.type(dialog.getByLabelText("Your feedback"), "Proceed with the pilot group.");
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await userEvent.click(dialog.getByRole("button", { name: "Reply in Overview" }));
    await expect(dialog.getByLabelText("Your feedback")).toHaveValue("Proceed with the pilot group.");
    await userEvent.click(dialog.getByRole("button", { name: "Expand task details" }));
    await expect(dialog.getByLabelText("Your feedback")).toHaveValue("Proceed with the pilot group.");
    await userEvent.click(dialog.getByRole("button", { name: "Submit feedback" }));
    await expect(args.onAnswerFeedback).toHaveBeenCalledWith(decision.id, "Proceed with the pilot group.");
  },
};
export const LongFeedback: Story = {
  ...PendingDecision,
  args: { ...PendingDecision.args, task: { ...exampleTasks[0], agentStatus: "Waiting", comments: [{ ...decision, body: decision.body + "\n\n" + Array.from({ length: 12 }, (_, index) => `### Check ${index + 1}\n\nThe pilot needs documented rollback instructions, a named owner, and confirmation that existing task history remains readable.`).join("\n\n") }] } },
};
export const ManyArtifacts: Story = {
  args: { open: true, task: { ...exampleTasks[0], comments: [{ ...decision, feedbackStatus: "answered" }] } },
  parameters: { artifactLinks: evidence.map((link, index) => index ? link : { ...link, comments: [{ commentId: decision.id, artifact: link.artifact }] }) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("tab", { name: "Artifacts" }));
    await userEvent.click(await dialog.findByRole("button", { name: /View 1 comment reference/ }));
    await userEvent.click(await body.findByRole("link", { name: /Comment 1/ }));
    await expect(dialog.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(canvasElement.ownerDocument.getElementById(`comment-${decision.id}`)).toHaveFocus());
  },
};
export const StableWorkspace: Story = {
  args: { open: true, task: exampleTasks[0], onPostComment: fn(), onRun: fn(), assignedColumns: [exampleTasks[0].status] },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Your comment" }), "Please check the keyboard navigation.");
    await userEvent.click(dialog.getByRole("button", { name: "Expand task details" }));
    await expect(dialog.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(dialog.getByRole("tab", { name: "Workflow" }));
    await expect(dialog.getByText(/No workflow is configured/)).toBeVisible();
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await expect(dialog.getByRole("textbox", { name: "Your comment" })).toHaveTextContent("Please check the keyboard navigation.");
    await userEvent.click(dialog.getByRole("textbox", { name: "Your comment" }));
    await userEvent.click(dialog.getByRole("button", { name: "Post comment" }));
    await expect(args.onPostComment).toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Run" }));
    await expect(args.onRun).toHaveBeenCalled();
  },
};

export const FeedbackReplyArtifact: Story = {
  ...ManyArtifacts,
  args: { open: true, task: { ...exampleTasks[0], comments: [
    { ...decision, feedbackStatus: "answered", runId: "review-run" },
    { id: "human-decision", taskId: exampleTasks[0].id, authorName: "Human", runId: "review-run", createdAt: "2026-11-18T11:00:00Z", body: "Proceed with the pilot. The attached checklist records the agreed scope.", artifacts: decision.artifacts },
  ] } },
  parameters: { artifactLinks: [{ ...evidence[0], comments: [{ commentId: "human-decision", artifact: evidence[0].artifact }] }] },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("tab", { name: "Artifacts" }));
    await userEvent.click(await dialog.findByRole("button", { name: /View 1 comment reference/ }));
    await userEvent.click(await body.findByRole("link", { name: /Comment 1/ }));
    await waitFor(() => expect(canvasElement.ownerDocument.getElementById("comment-human-decision")).toHaveFocus());
  },
};
