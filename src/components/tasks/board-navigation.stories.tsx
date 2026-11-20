import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
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
