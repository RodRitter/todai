import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { RunHistoryEntry } from "@/domain/execution";
import { RunHistory } from "./run-history";

const runs: RunHistoryEntry[] = [
  { id: "2", agentName: "Reviewer", status: "Running", createdAt: "2026-11-18T10:01:00Z", startedAt: "2026-11-18T10:02:00Z", finishedAt: null, summary: null, activity: [
    { id: "read", title: "Read src/components/tasks/run-history.tsx", status: "complete", detail: "Read the run history component.", createdAt: "2026-11-18T10:02:01Z", updatedAt: "2026-11-18T10:02:02Z" },
    { id: "test", title: "npm test", status: "running", createdAt: "2026-11-18T10:02:03Z", updatedAt: "2026-11-18T10:02:03Z" },
  ] },
  { id: "1", agentName: "Builder", status: "Complete", createdAt: "2026-11-18T09:00:00Z", startedAt: "2026-11-18T09:01:00Z", finishedAt: "2026-11-18T10:00:00Z", summary: "Implemented artifact previews.\n\n- Preserved pinned revisions\n- Verified keyboard access" },
];
const meta = {
  title: "Tasks/Run history", component: RunHistory,
  args: { taskId: "task", load: async () => runs },
  parameters: { layout: "padded" },
} satisfies Meta<typeof RunHistory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Collapsed: Story = {};
export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Run history" }));
    await expect(await canvas.findByText("Reviewer")).toBeVisible();
    await userEvent.click(canvas.getByText("View summary"));
    await expect(canvas.getByText("Implemented artifact previews.")).toBeVisible();
  },
};
export const Empty: Story = { args: { load: async () => [] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Run history" }));
  await expect(await canvas.findByText("No runs yet.")).toBeVisible();
} };
export const Unavailable: Story = { args: { load: async () => { throw new Error("Offline"); } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Run history" }));
  await expect(await canvas.findByRole("alert")).toHaveTextContent("Could not refresh run history.");
} };
export const Narrow: Story = { ...Expanded, decorators: [(Story) => <div className="max-w-72"><Story /></div>] };
export const Failed: Story = { ...Expanded, args: { load: async () => [runs[0], { ...runs[1], status: "Failed", summary: runs[1].summary }] } };

export const PreservesSummary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Run history" });
    await userEvent.click(trigger);
    await userEvent.click(await canvas.findByRole("button", { name: "View summary" }));
    await expect(canvas.getByText("Implemented artifact previews.")).toBeVisible();
    await userEvent.click(trigger);
    await expect(canvas.getByText("Implemented artifact previews.")).not.toBeVisible();
    await userEvent.click(trigger);
    await expect(canvas.getByText("Implemented artifact previews.")).toBeVisible();
  },
};
