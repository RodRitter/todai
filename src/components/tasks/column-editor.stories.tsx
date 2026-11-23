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
    await userEvent.click(within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByRole("button", { name: "Delete Done" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Delete Done" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).getByRole("button", { name: "Delete" }));
    await expect(canvas.queryByRole("button", { name: "Delete Done" })).not.toBeInTheDocument();
  },
};
export const SavedColumnDeletion: Story = { ...CompactDeletion, args: { compact: false } };

export const DenseRows: Story = {
  args: {
    initialColumns: ["Backlog", "In progress", "Ready for review", "Done"],
    initialTaskCounts: { Backlog: 12, "In progress": 3, "Ready for review": 2 },
  },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};
export const NarrowLongNames: Story = {
  args: { initialColumns: ["Research and validation before implementation", "Done"] },
  decorators: [(Story) => <div className="max-w-80"><Story /></div>],
};

export const ColumnInstructions: Story = {
  args: {
    initialInstructions: { "To do": "Check the task scope before planning." },
    configure: async (_column, name) => [name, "Done"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Configure To do" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Column settings" }));
    await expect(dialog.getByLabelText("Custom instructions")).toHaveValue("Check the task scope before planning.");
    await userEvent.clear(dialog.getByLabelText("Custom instructions"));
    await userEvent.type(dialog.getByLabelText("Custom instructions"), "Record open questions.");
    await userEvent.click(dialog.getByRole("button", { name: "Save settings" }));
    await userEvent.click(canvas.getByRole("button", { name: "Configure To do" }));
    const reopened = within(await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Column settings" }));
    await expect(reopened.getByLabelText("Custom instructions")).toHaveValue("Record open questions.");
  },
};
export const ColumnInstructionsDark: Story = { ...ColumnInstructions, globals: { theme: "dark" } };
