import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ColumnSettings } from "./column-settings";
import { statuses } from "@/domain/task";

const meta = {
  title: "Settings/Board columns",
  component: ColumnSettings,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("tab", { name: "Workspace" }));
    await userEvent.click(within(canvasElement).getByRole("tab", { name: "Boards" }));
  },
  render: function Render(args) {
    let columns = [...args.initialColumns];
    return (
      <ColumnSettings
        {...args}
        create={async (name) => {
          if (
            columns.some(
              (column) => column.toLowerCase() === name.trim().toLowerCase(),
            )
          ) {
            throw new Error("A column with that name already exists.");
          }
          columns = [...columns, name.trim()];
          return columns;
        }}
        rename={async (column, name) => {
          columns = columns.map((value) =>
            value === column ? name.trim() : value,
          );
          return columns;
        }}
        remove={async (column) => {
          columns = columns.filter((value) => value !== column);
          return columns;
        }}
        reorder={async (next) => {
          columns = next;
          return columns;
        }}
      />
    );
  },
  args: {
    generalSettings: <p className="text-sm text-muted-foreground">Your name applies to all workspaces.</p>,
    workspaceSettings: <div>Workspace directory</div>,
    transferSettings: <h2>Transfer configuration files</h2>,
    executorSettings: <div>Executor connections</div>,
    initialColumns: [...statuses],
    create: async (name) => [...statuses, name],
    reorder: async (columns) => columns,
    rename: async () => [...statuses],
    remove: async () => [...statuses],
  },
} satisfies Meta<typeof ColumnSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CustomColumns: Story = {
  args: {
    initialColumns: [
      "Planning",
      "To do",
      "In progress",
      "In review",
      "Done",
      "Follow up",
    ],
  },
};
export const FailedSave: Story = {
  render: (args) => (
    <ColumnSettings
      {...args}
      create={async () => {
        throw new Error("Could not save columns. Try again.");
      }}
      reorder={async () => {
        throw new Error("Could not save columns. Try again.");
      }}
      rename={async () => {
        throw new Error("Could not rename the column. Try again.");
      }}
      remove={async () => {
        throw new Error(
          "Move all tasks to another column before deleting this column.",
        );
      }}
    />
  ),
};

export const WithTaskCounts: Story = {
  args: {
    initialTaskCounts: {
      "To do": 12,
      "In progress": 1,
      "In review": 3,
      Done: 0,
    },
  },
};
export const LastColumn: Story = {
  args: { initialColumns: ["To do"] },
};

export const Global: Story = { play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByRole("tab", { name: "Global" })); } };
export const Workspace: Story = { play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByRole("tab", { name: "Workspace" })); } };
export const Dark: Story = { globals: { theme: "dark" } };

export const TransferSection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Workspace" }));
    await expect(canvas.queryByRole("tab", { name: "Import and export" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Transfer configuration files" })).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Environment" }));
    await expect(canvas.getByRole("heading", { name: "Transfer configuration files" })).toBeVisible();
  },
};

export const GlobalWorkspaceManagement: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tablist", { name: "Settings sections" })).toHaveTextContent("GlobalWorkspace");
    await expect(canvas.queryByRole("tab", { name: "New workspace" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "Archive" }));
    await expect(canvas.getByRole("heading", { name: "Archive" })).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Identity" }));
    await expect(canvas.queryByRole("heading", { name: "Archive" })).not.toBeInTheDocument();
  },
};
