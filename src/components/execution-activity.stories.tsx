import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { ExecutionActivityView } from "./execution-activity";
import type { ExecutionState } from "@/domain/execution";

const running: ExecutionState = {
  paused: false,
  active: {
    runId: "run", taskId: "task", taskTitle: "Implement workspace artifact previews",
    agentName: "Builder", workspaceId: "workspace", workspaceName: "Todai",
    workspacePath: "/projects/todai", stopping: false,
  },
};
const meta = {
  title: "Execution/Activity",
  component: ExecutionActivityView,
  args: { state: running, onAction: () => {} },
} satisfies Meta<typeof ExecutionActivityView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Running: Story = {};
export const Idle: Story = { args: { state: { paused: false, active: null } } };
export const Paused: Story = { args: { state: { paused: true, active: null } } };
export const Stopping: Story = { args: { state: { paused: true, active: { ...running.active!, stopping: true } }, busy: true } };
export const Unavailable: Story = { args: { state: null } };
export const ActionError: Story = { args: { error: "The active run changed. Refresh and try again." } };
export const LongContent: Story = { args: { state: { ...running, active: { ...running.active!, taskTitle: "Review the complete workspace artifact history and all supported revision previews before publishing", workspacePath: "/projects/a-workspace-with-a-very-long-name/another-long-directory/nested-project-directory" } } } };
export const StopAndResume: Story = {
  render: function Interactive() {
    const [state, setState] = useState(running);
    return <ExecutionActivityView state={state} onAction={(action) => setState({ paused: action !== "resume", active: null })} />;
  },
};

export const DirectoryConfirmation: Story = {
  args: { state: { paused: true, active: null, directoryChanges: [
    { runId: "queued", workspaceName: "Todai", previousPath: "/projects/old", path: "/projects/todai" },
  ] } },
};

export const QueuedJobs: Story = { args: { state: { ...running, queued: [
  { runId: "next", taskTitle: "Review the artifact preview", agentName: "Reviewer", workspaceName: "Todai", held: false },
  { runId: "held", taskTitle: "Update project documentation", agentName: "Writer", workspaceName: "Website", held: true },
] } } };
