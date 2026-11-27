import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { BoardNavigation } from "./board-navigation";

const meta = {
  title: "Tasks/Board navigation", component: BoardNavigation, tags: ["autodocs"],
  args: { active: true, initialBoards: [
    { id: "one", name: "Product", columns: ["Backlog", "Build"] },
    { id: "two", name: "Research and long-running investigations with a long board name", columns: ["Ideas", "Investigating"] },
  ] },
  decorators: [(Story) => <div className="w-60"><Story /></div>],
} satisfies Meta<typeof BoardNavigation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Boards: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const Reorder: Story = {
  args: { reorder: async (ids) => ids.map((id) => meta.args.initialBoards.find((board) => board.id === id)!) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const item = canvas.getByRole("link", { name: "Product" });
    item.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getAllByRole("link")[1]).toHaveAccessibleName("Product");
    await expect(item).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(canvas.getAllByRole("link")[0]).toHaveAccessibleName("Product");
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: () => {} };
    await fireEvent.dragStart(item, { dataTransfer });
    const target = canvas.getAllByRole("link")[1].closest("[data-dragging]")!;
    const clientY = target.getBoundingClientRect().bottom - 1;
    await fireEvent.dragOver(target, { dataTransfer, clientY });
    await expect(target.querySelector("[data-insertion=after]")).toBeInTheDocument();
    await fireEvent.drop(target, { dataTransfer, clientY });
    await expect(canvas.getAllByRole("link")[1]).toHaveAccessibleName("Product");
  },
};
export const SaveFailure: Story = {
  args: { reorder: async () => { throw new Error("Save failed"); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("link", { name: "Product" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getAllByRole("link")[0]).toHaveAccessibleName("Product");
  },
};
export const Collapse: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Product" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Boards" }));
    await expect(canvas.queryByRole("link", { name: "Product" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Boards" }));
    await expect(canvas.getByRole("link", { name: "Product" })).toBeVisible();
  },
};

export const DirectDragging: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Product" });
    await expect(link).toHaveAttribute("draggable", "true");
    await expect(canvas.queryByRole("button", { name: /Reorder/ })).not.toBeInTheDocument();
    const initialLeft = link.getBoundingClientRect().left;
    await userEvent.hover(link);
    await expect(link.getBoundingClientRect().left).toBe(initialLeft);
  },
};
export const SingleBoard: Story = {
  args: { initialBoards: [meta.args.initialBoards[0]] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: "Product" })).toHaveAttribute("draggable", "false");
  },
};
