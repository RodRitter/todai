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
  play: async ({ canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.queryByRole("tablist")).not.toBeInTheDocument();
    await expect(dialog.queryByRole("tab", { name: "Import JIRA Ticket" })).not.toBeInTheDocument();
  },
  parameters: { docs: { disable: true } },
};
export const DarkEdit: Story = { args: { open: true, task: exampleTasks[2] }, globals: { theme: "dark" } };
export const OpenEdit: Story = {
  args: { open: true, task: exampleTasks[2] },
  play: async ({ canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.getByText("TASK-3")).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Activity" })).toBeVisible();
    await expect(dialog.queryByRole("tab", { name: "Import JIRA Ticket" })).not.toBeInTheDocument();
  },
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
    await expect(dialog.getByText("Verified persistence.")).toBeVisible();
    await expect(dialog.getByText("Builder")).toBeVisible();
    await expect(dialog.getByText("Reviewer")).toBeVisible();
  },
};
export const FailedSave: Story = {
  args: { open: true, task: exampleTasks[0], onSave: fn() },
  play: async ({ canvasElement, args }) => {
    args.onSave.mockRejectedValueOnce(new Error("Save failed")).mockResolvedValue(undefined);
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Edit title" }));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Retained title");
    await userEvent.tab();
    await expect(await within(canvasElement.ownerDocument.body).findByText("Could not save changes. Your draft is still open.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Retained title");
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("button", { name: "Retry" }));
    await expect(await within(canvasElement.ownerDocument.body).findByText("Task saved.", { exact: true })).toBeVisible();
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
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await expect(
      dialog.getByRole("heading", { name: "Handover" }),
    ).toBeVisible();
    await userEvent.click(dialog.getByRole("tab", { name: "Detail" }));
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
    await userEvent.click(dialog.getByRole("tab", { name: "Detail" }));
    await waitFor(() =>
      expect(
        dialog.getByText("Updated requirements"),
      ).toBeVisible(),
    );
    await expect(
      dialog.getByRole("textbox", { name: "Description" }),
    ).toBeVisible();
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Updated requirements",
      }),
    );
    await expect(
      dialog.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  },
};

export const SaveDescriptionOnClose: Story = {
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
      "Save this draft",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ description: "Save this draft" })));
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
    await userEvent.click(dialog.getByRole("tab", { name: "Detail" }));
    await within(canvasElement.ownerDocument.body).findByText(
      "Could not save changes. Your draft is still open.",
    );
    await expect(dialog.getByLabelText("Description")).toHaveTextContent(
      "Retained draft",
    );
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(dialog.getByText("Retained draft")).toBeVisible(),
    );
    await expect(
      dialog.getByRole("textbox", { name: "Description" }),
    ).toBeVisible();
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
    await userEvent.click(dialog.getByRole("tab", { name: "Detail" }));
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated title" }));
  },
};

const importAgent = { id: "reader", name: "Reader", tool: "codex" as const, model: "gpt-6.1-sol", effort: "low" as const, permissions: "read-only" as const, instructions: "" };
export const MoveBetweenBoards: Story = {
  args: { open: true, boardId: "product", task: { ...exampleTasks[0], boardId: "product" }, boards: [
    { id: "product", name: "Product", columns: ["To do", "In progress", "In review", "Done"] },
    { id: "research", name: "Research", columns: ["Ideas", "Investigating"] },
  ] },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.selectOptions(dialog.getByLabelText("Board"), "research");
    await expect(dialog.getByLabelText("Status")).toHaveValue("Ideas");
    await expect(dialog.queryByRole("option", { name: "In progress" })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("tab", { name: "Detail" }));
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ boardId: "research", status: "Ideas" }));
  },
};

const descriptionArtifact = { id: "brief", title: "Brief", type: "markdown", creator: "You" };
const newDescriptionArtifact = { ...descriptionArtifact, id: "plan", title: "Plan" };
const referenceMocks = () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.startsWith("/api/artifacts")) {
      if (options?.method === "POST") return Response.json(newDescriptionArtifact);
      return Response.json(url.includes("search=Plan") ? [] : [descriptionArtifact]);
    }
    if (url.startsWith("/api/references")) {
      const skill = url.includes("kind=skill");
      return Response.json({ references: [{ kind: skill ? "skill" : "file", label: skill ? "$review" : "src/example.ts", path: skill ? "/skills/review" : "/src/example.ts", detail: "Workspace reference" }] });
    }
    return original(input, options);
  };
  return () => { globalThis.fetch = original; };
};

export const DescriptionReferences: Story = {
  args: { open: true, agents: [importAgent] },
  beforeEach: referenceMocks,
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const taskDialog = within(await page.findByRole("dialog"));
    if (args.task) await userEvent.click(taskDialog.getByRole("button", { name: "Edit description" }));
    else await userEvent.type(taskDialog.getByLabelText("Title"), "Referenced task");
    const editor = taskDialog.getByRole("textbox", { name: "Description" });
    await userEvent.click(editor);
    await userEvent.keyboard("{End} ");
    for (const [tag, option, label, href] of [
      ["@Reader", /@Reader/, "@Reader", "#agent/reader"],
      ["$review", /\$review/, "$review", "/skills/review"],
      ["/src", /src\/example.ts/, "src/example.ts", "/src/example.ts"],
      ["#Brief", /Brief Revision/, "Brief", "#artifact/brief/r1"],
    ] as const) {
      await userEvent.keyboard(tag);
      await taskDialog.findByRole("option", { name: option });
      await userEvent.keyboard("{Enter}");
      await expect(taskDialog.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    await userEvent.keyboard("#Plan");
    await taskDialog.findByRole("option", { name: "Create artifact “Plan”" });
    await userEvent.keyboard("{Enter}");
    const artifactDialog = within(await page.findByRole("dialog", { name: "Create artifact" }));
    await userEvent.click(artifactDialog.getByRole("button", { name: "Cancel" }));
    await expect(editor).toHaveTextContent("#Plan");
    if (!args.task) await expect(args.onSave).not.toHaveBeenCalled();
    await userEvent.click(editor);
    await userEvent.keyboard("{End}x{Backspace}");
    await taskDialog.findByRole("option", { name: "Create artifact “Plan”" });
    await userEvent.keyboard("{Enter}");
    const reopened = within(await page.findByRole("dialog", { name: "Create artifact" }));
    await userEvent.click(reopened.getByRole("textbox", { name: "Document content" }));
    await userEvent.keyboard("Plan details");
    await userEvent.click(reopened.getByRole("button", { name: "Save and attach" }));
    await expect(await taskDialog.findByRole("link", { name: "Plan" })).toHaveAttribute("href", "#artifact/plan/r1");
    if (args.task) await userEvent.click(taskDialog.getByRole("tab", { name: "Detail" }));
    else await userEvent.click(taskDialog.getByRole("button", { name: "Create task" }));
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("#artifact/plan/r1") })));
  },
};

export const EditDescriptionReferences: Story = {
  ...DescriptionReferences,
  args: { ...DescriptionReferences.args, task: { ...exampleTasks[2], description: "" } },
};


export const ExpandedTaskPanelByDefault: Story = {
  args: { open: true, task: exampleTasks[2] },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const panel = await page.findByRole("dialog");
    const dialog = within(panel);
    await userEvent.click(dialog.getByRole("button", { name: "Edit title" }));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Retained expanded draft{Enter}");
    const originalWidth = panel.getBoundingClientRect().width;
    const expand = dialog.getByRole("button", { name: "Task actions" });
    expand.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await page.findByRole("menuitem", { name: "Collapse task panel" }));
    await waitFor(() => {
      const width = panel.getBoundingClientRect().width;
      expect(width).toBeLessThanOrEqual(originalWidth);
      expect(width).toBeLessThanOrEqual(1024);
      expect(width).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth - 32);
      if (canvasElement.ownerDocument.documentElement.clientWidth > 800) expect(width).toBeLessThan(originalWidth);
      expect(panel.querySelector("form")!.getBoundingClientRect().width).toBeLessThanOrEqual(1024);
    });
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Retained expanded draft");
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await userEvent.click(dialog.getByRole("button", { name: "Task actions" }));
    await userEvent.click(await page.findByRole("menuitem", { name: "Expand task panel" }));
    await waitFor(() => expect(panel.getBoundingClientRect().width).toBe(originalWidth));
    await expect(dialog.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(dialog.getByRole("tab", { name: "Detail" }));
    await expect(dialog.getByRole("button", { name: "Edit title" })).toHaveTextContent("Retained expanded draft");
  },
};

export const TaskChatTab: Story = {
  args: { task: { ...exampleTasks[2], comments: [{ id: "source", taskId: exampleTasks[2].id, authorName: "Reviewer", body: "Review this change.", createdAt: "2026-11-20T10:00:00Z" }] }, open: true,
    agents: [{ id: "reviewer", name: "Reviewer", tool: "codex", model: "test", effort: "low", permissions: "read-only", instructions: "Review changes." }] },
  beforeEach: () => {
    const original = globalThis.fetch;
    const session = { id: "task-chat", taskId: exampleTasks[2].id, createdAt: "2026-11-20T10:00:00Z", updatedAt: "2026-11-20T10:00:00Z", messages: [] as { id: string; body: string; authorName: string; createdAt: string }[], running: false, error: null };
    globalThis.fetch = async (input, options) => {
      if (String(input).startsWith("/api/chats")) {
        if (options?.method === "POST") session.messages.push({ id: "sent", body: JSON.parse(String(options.body)).body, authorName: "Human", createdAt: session.createdAt });
        return Response.json(session);
      }
      return String(input).startsWith("/api/artifacts") ? Response.json([]) : original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    const chat = dialog.getByRole("tab", { name: "Chat" });
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await userEvent.click(dialog.getByRole("button", { name: "Chat" }));
    await expect(chat).toHaveAttribute("data-state", "active");
    const composer = await dialog.findByRole("textbox", { name: "Your chat message" });
    await expect(composer).toHaveTextContent("@Reviewer");
    await expect(composer).toHaveTextContent("Comment by Reviewer");
    const surface = composer.closest('[data-slot="input-group"]')!;
    const field = surface.getBoundingClientRect();
    const viewport = surface.closest('[data-slot="scroll-area-viewport"]')!.getBoundingClientRect();
    await expect(field.left - viewport.left).toBeGreaterThanOrEqual(3);
    await expect(viewport.right - field.right).toBeGreaterThanOrEqual(3);
    await waitFor(() => expect(composer).toHaveFocus());
    await userEvent.type(composer, " Please explain.");
    await userEvent.click(dialog.getByRole("tab", { name: "Activity" }));
    await userEvent.click(chat);
    await expect(composer).toHaveTextContent("Please explain.");
    await expect(body.getAllByRole("dialog")).toHaveLength(1);
    await userEvent.click(dialog.getByRole("button", { name: "Send chat message" }));
    const messages = await dialog.findByRole("list", { name: "Chat messages, newest first" });
    await expect(messages.children).toHaveLength(1);
    await userEvent.click(within(messages).getByRole("button", { name: "Comment by Reviewer" }));
    await expect(dialog.getByRole("tab", { name: "Activity" })).toHaveAttribute("data-state", "active");
    await waitFor(() => expect(canvasElement.ownerDocument.getElementById("comment-source")).toHaveFocus());
  },
};

export const ChatLoadFailure: Story = {
  ...TaskChatTab,
  args: { ...TaskChatTab.args, initialTab: "chat" },
  beforeEach: () => {
    const original = globalThis.fetch;
    let reads = 0;
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/chats")
      ? (++reads === 1 ? Response.json({ error: "Chat is unavailable." }, { status: 503 }) : Response.json({ id: "chat", taskId: exampleTasks[2].id, messages: [], running: false, error: null }))
      : String(input).startsWith("/api/artifacts") ? Response.json([]) : original(input, options);
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(await dialog.findByRole("alert")).toHaveTextContent("Chat is unavailable.");
    await userEvent.click(dialog.getByRole("button", { name: "Retry chat" }));
    await expect(await dialog.findByRole("textbox", { name: "Your chat message" })).toBeVisible();
  },
};

export const HeaderWithLongTitle: Story = {
  args: {
    open: true,
    task: { ...exampleTasks[2], title: "Review the task header with a long title that stays on one line and shows an ellipsis on a narrow screen" },
    assignedColumns: [exampleTasks[2].status],
    assignments: [{ column: exampleTasks[2].status, agentId: "reviewer" }],
    agents: [{ id: "reviewer", name: "Reviewer", tool: "codex", model: "gpt-6.1-sol", effort: "medium", instructions: "", permissions: "read-only" }],
    onRun: fn(),
  },
  play: async ({ canvasElement }) => {
    const panel = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    const header = within(panel.querySelector('[data-slot="dialog-header"]') as HTMLElement);
    const title = header.getByRole("button", { name: "Edit title" });
    const expand = header.getByRole("button", { name: "Task actions" });
    const close = header.getByRole("button", { name: "Close" });
    const run = within(panel).getByRole("button", { name: "Run" });
    await expect(expand.getBoundingClientRect().left).toBeGreaterThanOrEqual(title.getBoundingClientRect().right);
    await expect(close.getBoundingClientRect().left).toBeGreaterThanOrEqual(expand.getBoundingClientRect().right);
    await expect(run.getBoundingClientRect().top).toBeGreaterThanOrEqual(title.getBoundingClientRect().bottom);
    const titleStyle = getComputedStyle(title);
    await expect(titleStyle.whiteSpace).toBe("nowrap");
    await expect(titleStyle.textOverflow).toBe("ellipsis");
    await userEvent.click(expand);
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Collapse task panel" }));
    await waitFor(() => {
      const headerBounds = panel.querySelector('[data-slot="dialog-header"]')!.getBoundingClientRect();
      const contentBounds = panel.querySelector("form")!.getBoundingClientRect();
      expect(headerBounds.width).toBeLessThanOrEqual(1024);
      expect(Math.abs(headerBounds.left - contentBounds.left)).toBeLessThan(1);
      expect(Math.abs(headerBounds.width - contentBounds.width)).toBeLessThan(1);
    });
    await userEvent.click(within(panel).getByRole("tab", { name: "Activity" }));
    await expect(title).toBeVisible();
    await userEvent.click(title);
    await userEvent.clear(header.getByLabelText("Title"));
    await userEvent.type(header.getByLabelText("Title"), "Draft title{Enter}");
    await waitFor(() => expect(run).toBeEnabled());
  },
};

export const HeaderWithStop: Story = {
  args: {
    open: true,
    task: { ...exampleTasks[2], agentStatus: "Running" },
    onStop: fn(),
  },
};

export const AutosaveControls: Story = {
  args: { open: true, task: exampleTasks[2], onSave: fn(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); }) },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.selectOptions(dialog.getByLabelText("Status", { exact: true }), "Done");
    await userEvent.click(dialog.getByRole("switch", { name: "Auto-workflow" }));
    await userEvent.click(dialog.getByRole("switch", { name: "Auto-run" }));
    await waitFor(() => expect(args.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ status: "Done", autoWorkflow: !exampleTasks[2].autoWorkflow, autoRun: !exampleTasks[2].autoRun })));
    await expect(dialog.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  },
};

export const ChatCount: Story = {
  args: { open: true, task: exampleTasks[2] },
  beforeEach: () => {
    const original = globalThis.fetch;
    const session = { id: "chat-count", taskId: exampleTasks[2].id, running: false, error: null,
      messages: [
        { id: "human", authorName: "Human", body: "Explain the task.", createdAt: "2026-11-20T10:00:00Z" },
        { id: "agent", authorName: "Agent", body: "This is the task context.", createdAt: "2026-11-20T10:01:00Z" },
      ],
    };
    globalThis.fetch = async (input, options) => {
      if (String(input).startsWith("/api/chats")) {
        const data = options?.body ? JSON.parse(String(options.body)) : {};
        if (options?.method === "POST") session.messages.push({ id: "sent", authorName: "Human", body: data.body, createdAt: "2026-11-20T10:02:00Z" });
        if (options?.method === "DELETE") session.messages = data.clear ? [] : session.messages.filter((message) => message.id !== data.messageId);
        return Response.json(session);
      }
      return String(input).startsWith("/api/artifacts") ? Response.json([]) : original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    const chat = dialog.getByRole("tab", { name: "Chat" });
    await waitFor(() => expect(chat).toHaveTextContent("Chat2"));
    await expect(chat).toHaveAttribute("aria-description", "2 messages");
    await expect(dialog.getByRole("tab", { name: "Detail" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(chat);
    await userEvent.type(await dialog.findByRole("textbox", { name: "Your chat message" }), "More detail, please.");
    await userEvent.click(dialog.getByRole("button", { name: "Send chat message" }));
    await waitFor(() => expect(chat).toHaveTextContent("Chat3"));
    await userEvent.click(dialog.getAllByRole("button", { name: "Delete chat message" })[0]);
    await userEvent.click(within(await page.findByRole("dialog", { name: "Delete chat message?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(chat).toHaveTextContent("Chat2"));
    await userEvent.click(dialog.getByRole("button", { name: "Clear chat" }));
    await userEvent.click(within(await page.findByRole("dialog", { name: "Clear chat?" })).getByRole("button", { name: "Clear chat" }));
    await waitFor(() => expect(chat).toHaveTextContent("Chat0"));
  },
};
export const ChatCountDark: Story = { ...ChatCount, globals: { theme: "dark" } };

export const ResetTask: Story = {
  args: { open: true, task: exampleTasks[3], onReset: fn().mockResolvedValue(undefined) },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: "Task actions" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Reset task" }));
    const prompt = within(await body.findByRole("dialog", { name: "Reset task?" }));
    await expect(prompt.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await expect(args.onReset).not.toHaveBeenCalled();
    await userEvent.click(prompt.getByRole("button", { name: "Cancel" }));
    await expect(args.onReset).not.toHaveBeenCalled();
    await userEvent.click(body.getByRole("button", { name: "Task actions" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Reset task" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: "Reset task?" })).getByRole("button", { name: "Reset task" }));
    await waitFor(() => expect(args.onReset).toHaveBeenCalledWith(args.task!.id));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "Reset task?" })).not.toBeInTheDocument());
  },
};

export const ResetPending: Story = {
  args: { open: true, task: exampleTasks[3], onReset: () => new Promise<void>(() => {}) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: "Task actions" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Reset task" }));
    const prompt = within(await body.findByRole("dialog", { name: "Reset task?" }));
    await userEvent.click(prompt.getByRole("button", { name: "Reset task" }));
    await expect(await prompt.findByRole("button", { name: "Resetting…" })).toBeDisabled();
    await expect(prompt.getByRole("button", { name: "Cancel" })).toBeDisabled();
  },
};

export const ResetFailure: Story = {
  args: { open: true, task: exampleTasks[3], onReset: fn().mockRejectedValue(new Error("Wait for the chat response to finish before resetting the task.")) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: "Task actions" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Reset task" }));
    const prompt = within(await body.findByRole("dialog", { name: "Reset task?" }));
    await userEvent.click(prompt.getByRole("button", { name: "Reset task" }));
    await waitFor(() => expect(prompt.getByRole("button", { name: "Reset task" })).toBeEnabled());
    await expect(prompt.getByRole("button", { name: "Cancel" })).toBeEnabled();
  },
};

export const ResetWhileRunning: Story = {
  args: { open: true, task: exampleTasks[2], onReset: fn() },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: "Task actions" }));
    await expect(body.getByRole("menuitem", { name: "Reset task" })).toHaveAttribute("aria-disabled", "true");
  },
};

export const ResetPendingDark: Story = { ...ResetPending, globals: { theme: "dark" } };

export const RetryMemoryReview: Story = {
  args: {
    open: true,
    task: { ...exampleTasks[3], status: "Done", agentStatus: "Failed" },
    completionColumn: "Done",
    assignedColumns: [],
    onRun: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const run = await body.findByRole("button", { name: "Run" });
    await expect(run).toBeEnabled();
    await userEvent.click(run);
    await expect(args.onRun).toHaveBeenCalledOnce();
  },
};
