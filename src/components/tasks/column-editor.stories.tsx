import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ColumnEditor } from "./column-editor";

const meta = {
  title: "Settings/Column editor",
  component: ColumnEditor,
  args: {
    initialColumns: ["To do", "Done"],
    create: async (name) => ["To do", "Done", name],
    reorder: async (columns) => columns,
    rename: async () => ["To do", "Done"],
    remove: async (column) => ["To do", "Done"].filter((name) => name !== column),
  },
} satisfies Meta<typeof ColumnEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CompactDeletion: Story = {
  args: { compact: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Delete Done" }));
    await userEvent.click(within(await body.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByRole("button", { name: "Delete Done" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Delete Done" }));
    await userEvent.click(within(await body.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await expect(canvas.queryByRole("button", { name: "Delete Done" })).not.toBeInTheDocument();
  },
};
export const SavedColumnDeletion: Story = { ...CompactDeletion, args: { compact: false } };
