import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BoardSettings } from "./board-settings";
const boards = [{ id: "default", name: "Product", columns: ["Backlog", "Build"] }, { id: "research", name: "Research", columns: ["Ideas"] }];
const meta = {
  title: "Tasks/Board settings", component: BoardSettings, tags: ["autodocs"],
  args: { boards, persistence: {
    reorder: fn(async (ids: string[]) => ids.map((id) => boards.find((board) => board.id === id)!)),
    list: fn(async () => boards),
    create: fn(async (name: string, description?: string) => ({ id: "new", name, description, columns: ["To do"] })),
    rename: fn(async (id: string, name: string, description?: string) => ({ id, name, description, columns: ["To do"] })),
    remove: fn(async () => {}),
  }, columnsForBoard: (id: string) => {
    let columns = [...(boards.find((board) => board.id === id)?.columns ?? ["To do"])];
    return {
      load: async () => ({ columns, tasks: [], assignments: [] }),
      create: async (name: string) => (columns = [...columns, name]),
      rename: async (column: string, name: string) => (columns = columns.map((value) => value === column ? name : value)),
      remove: async (column: string) => (columns = columns.filter((value) => value !== column)),
      reorder: async (next: string[]) => (columns = next),
    };
  } },
  decorators: [(Story) => <div className="mx-auto max-w-2xl p-4"><Story /></div>],
} satisfies Meta<typeof BoardSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Manage: Story = {};
export const LocalNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", { name: "Board breadcrumbs" })).toHaveTextContent("All boards");
    await expect(canvas.queryByRole("heading", { name: "Board columns" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Research" }));
    await expect(await canvas.findByRole("heading", { name: "Board columns" })).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Board breadcrumbs" })).toHaveTextContent("All boardsResearch");
    await expect(canvas.queryByRole("list", { name: "Boards" })).not.toBeInTheDocument();
    await expect(canvas.getByText("Ideas", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "All boards" }));
    await expect(canvas.getByRole("list", { name: "Boards" })).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Board breadcrumbs" })).toHaveTextContent("All boards");
    await expect(canvas.queryByRole("heading", { name: "Board columns" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Product" }));
    await expect(await canvas.findByText("Backlog", { exact: true })).toBeVisible();
    await expect(canvas.queryByText("Ideas", { exact: true })).not.toBeInTheDocument();
  },
};
export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "New" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Board name"), "Marketing");
    await userEvent.type(dialog.getByLabelText("Description"), "Plan marketing tasks.");
    await userEvent.click(dialog.getByRole("button", { name: "Create board" }));
    await expect(args.persistence?.create).toHaveBeenCalledWith("Marketing", "Plan marketing tasks.");
    await expect(await canvas.findByRole("navigation", { name: "Board breadcrumbs" })).toHaveTextContent("Marketing");
    await userEvent.click(canvas.getByRole("button", { name: "All boards" }));
    await expect(canvas.getByRole("button", { name: "Marketing" })).toBeVisible();
  },
};
export const DuplicateName: Story = {
  args: { persistence: { ...meta.args.persistence, create: fn(async () => { throw new Error("A board with that name already exists."); }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "New" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Board name"), "Product");
    await userEvent.type(dialog.getByLabelText("Description"), "Plan marketing tasks.");
    await userEvent.click(dialog.getByRole("button", { name: "Create board" }));
    await expect(dialog.getByLabelText("Board name")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByLabelText("Board name")).toHaveValue("Product");
  },
};
export const LoadingFailure: Story = {
  args: { columnsForBoard: (id) => ({ ...meta.args.columnsForBoard(id), load: async () => { throw new Error("Offline"); } }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Research" }));
    await expect(await canvas.findByRole("button", { name: "Retry" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "All boards" }));
    await expect(canvas.getByRole("list", { name: "Boards" })).toBeVisible();
  },
};

export const SelectedBoard: Story = {
  args: { initialBoardId: "research" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Board name")).toHaveValue("Research");
    await expect(canvas.getByLabelText("Description")).toBeVisible();
  },
};
