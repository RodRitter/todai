import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
