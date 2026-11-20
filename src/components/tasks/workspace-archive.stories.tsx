import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";
import { WorkspaceArchiveView } from "./workspace-archive";

const archived = [{ id: "project", name: "Earlier project", path: "/projects/earlier-project" }];
const meta = {
  title: "Settings/Workspace archive",
  component: WorkspaceArchiveView,
  args: { archived, onArchive: () => {}, onRestore: () => {}, onRefresh: () => {} },
} satisfies Meta<typeof WorkspaceArchiveView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { archived: [] } };
export const AllArchived: Story = { args: { allowArchive: false } };
export const Busy: Story = { args: { busy: true } };
export const PendingJobs: Story = { args: { error: "Finish queued and running jobs before archiving this workspace." } };
export const LongContent: Story = { args: { archived: [{ id: "long", name: "An earlier workspace with a long descriptive name", path: "/projects/a-workspace-with-a-very-long-name/another-long-directory/nested-project-directory" }] } };
export const ArchiveAndRestore: Story = {
  render: function Interactive() {
    const [items, setItems] = useState<typeof archived>([]);
    return <WorkspaceArchiveView archived={items} allowArchive={!items.length}
      onArchive={() => setItems(archived)} onRestore={() => setItems([])} onRefresh={() => {}} />;
  },
};

export const CurrentWorkspace: Story = { args: { allowRestore: false } };
export const ConfirmArchive: Story = {
  args: { allowRestore: false, onArchive: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Archive this workspace" }));
    let dialog = within(await page.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
    await expect(args.onArchive).not.toHaveBeenCalled();
    await expect(dialog.getByText(/You can restore it from Archived/)).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(page.queryByRole("dialog", { name: /^(Delete|Clear|Archive)/ })).not.toBeInTheDocument();
    await expect(args.onArchive).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Archive this workspace" }));
    dialog = within(await page.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
    await userEvent.click(dialog.getByRole("button", { name: "Archive workspace" }));
    await expect(args.onArchive).toHaveBeenCalledTimes(1);
  },
};
