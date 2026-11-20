import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { TaskBoard } from "./task-board";
import { exampleTasks } from "./task.fixtures";

const meta = {
  title: "Tasks/Task board",
  component: TaskBoard,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { initialTasks: exampleTasks },
} satisfies Meta<typeof TaskBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongContent: Story = {
  args: {
    initialTasks: exampleTasks.map((task) => ({
      ...task,
      title: `${task.title} and coordinate the remaining design, accessibility, and release preparation work with the team`,
      description: "Review the full implementation, collect feedback from everyone involved, and document the remaining decisions before the next release. Check the layout on narrow and wide screens.",
    })),
  },
};
export const Empty: Story = { args: { initialTasks: [] } };
export const AllColumns: Story = {
  args: {
    initialTasks: [
      ...exampleTasks,
      {
        ...exampleTasks[3],
        id: "5",
        title: "Review the task board",
        status: "In review",
      },
    ],
  },
};
export const CreateEditDelete: Story = {
  args: { initialTasks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "New task" }));
    let dialog = within(await body.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Title"), "A new task");
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /^Edit A new task,/ }),
    );
    dialog = within(await body.findByRole("dialog"));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Updated task");
    await userEvent.selectOptions(dialog.getByLabelText("Status"), "In review");
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const review = within(canvas.getByRole("region", { name: "In review" }));
    await userEvent.click(
      review.getByRole("button", { name: /^Edit Updated task,/ }),
    );
    dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Delete task" }));
    const confirmation = within(await body.findByRole("alertdialog"));
    await expect(confirmation.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.click(confirmation.getByRole("button", { name: "Cancel" }));
    await expect(dialog.getByRole("button", { name: "Delete task" })).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Delete task" }));
    await userEvent.click(within(await body.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.queryByRole("button", { name: /^Edit Updated task,/ }),
    ).not.toBeInTheDocument();
  },
};
export const MoveCard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("button", {
      name: /^Edit Build the task board,/,
    });
    await expect(card).toHaveAttribute("draggable", "true");
    const target = canvas.getByRole("region", { name: "In review" });
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(card, { dataTransfer });
    await fireEvent.dragOver(target, { dataTransfer });
    await fireEvent.drop(target, { dataTransfer });
    await fireEvent.dragEnd(card, { dataTransfer });
    await expect(
      within(target).getByRole("button", {
        name: /^Edit Build the task board,/,
      }),
    ).toBeInTheDocument();
  },
};

export const MoveKeepsColumnsStill: Story = {
  args: { persistence: { save: async (task) => task, delete: async () => {} } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    let finishSave: (() => void) | undefined;
    args.persistence!.save = (task) =>
      new Promise((resolve) => {
        finishSave = () => resolve(task);
      });
    const headings = canvas.getAllByRole("heading", { level: 2 });
    const positions = headings.map(
      (heading) => heading.getBoundingClientRect().top,
    );
    const card = canvas.getByRole("button", {
      name: /^Edit Build the task board,/,
    });
    const target = canvas.getByRole("region", { name: "In review" });
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(card, { dataTransfer });
    await fireEvent.dragOver(target, { dataTransfer });
    await fireEvent.drop(target, { dataTransfer });
    await fireEvent.dragEnd(card, { dataTransfer });
    try {
      await within(canvasElement.ownerDocument.body).findByText("Moving task…");
      await expect(
        headings.map((heading) => heading.getBoundingClientRect().top),
      ).toEqual(positions);
    } finally {
      finishSave?.();
    }
    await waitFor(() =>
      expect(
        within(target).getByRole("button", {
          name: /^Edit Build the task board,/,
        }),
      ).toBeInTheDocument(),
    );
    await expect(
      headings.map((heading) => heading.getBoundingClientRect().top),
    ).toEqual(positions);
  },
};

const reviewer = {
  id: "reviewer",
  name: "Reviewer",
  tool: "codex",
  model: "custom-model",
  effort: "high",
  instructions: "",
  permissions: "read-only",
} as const;

export const AssignColumnAgent: Story = {
  args: { initialTasks: [], initialAgents: [reviewer] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Configure agent for In review" }),
    );
    let dialog = within(await body.findByRole("dialog"));
    await userEvent.selectOptions(
      dialog.getByLabelText("Assigned agent"),
      "reviewer",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Save assignment" }),
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByLabelText("Assigned agent: Reviewer"),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Configure agent for In review" }),
    );
    dialog = within(await body.findByRole("dialog"));
    await expect(dialog.getByLabelText("Assigned agent")).toHaveValue(
      "reviewer",
    );
    await userEvent.selectOptions(dialog.getByLabelText("Assigned agent"), "");
    await userEvent.click(
      dialog.getByRole("button", { name: "Save assignment" }),
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      within(canvas.getByRole("region", { name: "In review" })).getByText(
        "No agent assigned",
      ),
    ).toBeVisible();
  },
};

export const FailedColumnAgentSave: Story = {
  args: {
    initialAgents: [reviewer],
    assignAgent: async () => {
      throw new Error("Storage unavailable");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Configure agent for Done" }),
    );
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.selectOptions(
      dialog.getByLabelText("Assigned agent"),
      "reviewer",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Save assignment" }),
    );
    await body.findByText(
      "Could not save assignment. Reload to check available agents, or try again.",
    );
    await expect(dialog.getByLabelText("Assigned agent")).toHaveValue(
      "reviewer",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(
      within(canvas.getByRole("region", { name: "Done" })).getByText(
        "No agent assigned",
      ),
    ).toBeVisible();
  },
};

export const LiveExecution: Story = {
  args: {
    initialTasks: [
      {
        id: "live",
        title: "Build the feature",
        description: "Use shared components.",
        status: "In progress",
        agentStatus: "Running",
        comments: [],
      },
    ],
    persistence: {
      save: async (task) => task,
      delete: async () => {},
      list: async () => [
        {
          id: "live",
          title: "Build the feature",
          description: "Use shared components.",
          status: "In progress",
          agentStatus: "Complete",
          comments: [
            {
              id: "handover",
              taskId: "live",
              body: "Implemented and verified the feature.",
              createdAt: "2026-11-16T12:00:00Z",
            },
          ],
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit Build the feature, Running" }),
    );
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Unsaved draft");
    await waitFor(
      () =>
        expect(
          dialog.getByText("Implemented and verified the feature."),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    );
    await expect(dialog.getByLabelText("Title")).toHaveValue("Unsaved draft");
    await expect(
      canvas.getByRole("button", { name: "Edit Build the feature, Complete" }),
    ).toBeInTheDocument();
  },
};

export const ExecutionOutcomes: Story = {
  args: {
    initialTasks: [
      {
        id: "queued",
        title: "Waiting for the agent",
        description: "",
        status: "In progress",
        agentStatus: "Queued",
      },
      {
        id: "failed",
        title: "Failed execution",
        description: "",
        status: "In progress",
        agentStatus: "Failed",
        comments: [
          {
            id: "failure",
            taskId: "failed",
            body: "Agent run failed: Could not launch Codex CLI. Check that codex is installed and signed in.",
            createdAt: "2026-11-16T12:00:00Z",
          },
        ],
      },
      {
        id: "interrupted",
        title: "App restarted during execution",
        description: "",
        status: "In review",
        agentStatus: "Interrupted",
      },
    ],
  },
};

export const ResponsiveColumns: Story = {
  args: {
    columns: [
      "Backlog",
      "To do",
      "In progress",
      "In review",
      "Done",
      "Follow up",
    ],
    initialTasks: exampleTasks,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Resize the board or collapse the sidebar: columns share one row when space allows, then wrap at a readable 14rem minimum. Narrow screens use the full available width.",
      },
    },
  },
};

export const OpenComments: Story = {
  args: {
    initialTasks: [{
      ...exampleTasks[0],
      comments: [{ id: "comment-1", taskId: exampleTasks[0].id, body: "Ready for review.", createdAt: "2026-11-17T08:00:00.000Z" }],
    }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "1 comment" }));
    let dialog = within(await body.findByRole("dialog"));
    await expect(dialog.getByRole("tab", { name: /Activity/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: /^Edit / }));
    dialog = within(await body.findByRole("dialog"));
    await expect(dialog.getByRole("tab", { name: "Detail" })).toHaveAttribute("aria-selected", "true");
  },
};
