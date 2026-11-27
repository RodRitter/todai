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
    const body = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText("Backlog", { exact: true })).toBeVisible();
    await expect(canvas.queryByRole("navigation", { name: "Board breadcrumbs" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("combobox", { name: "Board" }));
    await userEvent.click(body.getByRole("option", { name: "Research" }));
    await expect(await canvas.findByText("Ideas", { exact: true })).toBeVisible();
    await expect(canvas.queryByText("Backlog", { exact: true })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("combobox", { name: "Board" }));
    await userEvent.click(body.getByRole("option", { name: "Product" }));
    await expect(await canvas.findByText("Backlog", { exact: true })).toBeVisible();
  },
};
export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "New board" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Board name"), "Marketing");
    await userEvent.type(dialog.getByLabelText("Description"), "Plan marketing tasks.");
    await userEvent.click(dialog.getByRole("button", { name: "Create board" }));
    await expect(args.persistence?.create).toHaveBeenCalledWith("Marketing", "Plan marketing tasks.");
    await expect(canvas.getByRole("combobox", { name: "Board" })).toHaveTextContent("Marketing");
    await expect(canvas.getByRole("button", { name: "Edit board name: Marketing" })).toBeVisible();
  },
};
export const DuplicateName: Story = {
  args: { persistence: { ...meta.args.persistence, create: fn(async () => { throw new Error("A board with that name already exists."); }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "New board" }));
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
    await expect(await canvas.findByRole("button", { name: "Retry" })).toBeVisible();
    await expect(canvas.getByRole("combobox", { name: "Board" })).toBeEnabled();
  },
};

export const SelectedBoard: Story = {
  args: { initialBoardId: "research" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Edit board name: Research" })).toBeVisible();
    await expect(canvas.getByLabelText("Description")).toBeVisible();
  },
};

export const Narrow: Story = { decorators: [(Story) => <div className="w-80"><Story /></div>] };
export const Dark: Story = { globals: { theme: "dark" } };
