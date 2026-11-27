import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { WorkspaceCleanup } from "./workspace-cleanup";
import type { CleanupPreview } from "@/domain/workspace-cleanup";

const preview: CleanupPreview = {
  retentionDays: 90, asOf: "2026-11-27T12:00:00.000Z", token: "preview", blocked: null,
  counts: { task: 1, artifact: 0, memory: 0 },
  remove: [{ kind: "task", id: "old-task", title: "Completed investigation with a long task title that wraps on narrow screens", reason: "No retained record needs this record." }],
  keep: [{ kind: "artifact", id: "evidence", title: "Decision evidence", reason: "Referenced by retained content." }],
};
const meta = {
  title: "Tasks/Workspace cleanup", component: WorkspaceCleanup, tags: ["autodocs"],
  decorators: [(Story) => <div className="mx-auto max-w-2xl p-4"><Story /></div>],
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => Response.json(preview);
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof WorkspaceCleanup>;
export default meta;
type Story = StoryObj<typeof meta>;
async function openPreview(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Preview cleanup" }));
  return canvas;
}
export const Default: Story = {};
export const Populated: Story = { play: async ({ canvasElement }) => {
  const canvas = await openPreview(canvasElement);
  await expect(await canvas.findByText(/1 tasks, 0 artifacts/)).toBeVisible();
  await userEvent.click(canvas.getByText("Records to remove (1)"));
  await expect(canvas.getByText(/Completed investigation/)).toBeVisible();
} };
export const Dark: Story = { ...Populated, globals: { theme: "dark" } };
export const Empty: Story = {
  beforeEach: () => { globalThis.fetch = async () => Response.json({ ...preview, remove: [], keep: [], counts: { task: 0, artifact: 0, memory: 0 } }); },
  play: async ({ canvasElement }) => {
    const canvas = await openPreview(canvasElement);
    await expect(await canvas.findByText("No records are eligible for cleanup.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Remove eligible records" })).toBeDisabled();
  },
};
export const Blocked: Story = {
  beforeEach: () => { globalThis.fetch = async () => Response.json({ ...preview, blocked: "Stop active runs and chats. Clear queued runs before cleanup." }); },
  play: async ({ canvasElement }) => {
    const canvas = await openPreview(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Remove eligible records" })).toBeDisabled();
  },
};
export const Pending: Story = {
  beforeEach: () => { globalThis.fetch = () => new Promise<Response>(() => {}); },
  play: async ({ canvasElement }) => {
    const canvas = await openPreview(canvasElement);
    await expect(canvas.getByLabelText("Retention period")).toBeDisabled();
  },
};
export const Failure: Story = {
  beforeEach: () => { globalThis.fetch = async () => Response.json({ error: "Could not load cleanup preview." }, { status: 500 }); },
  play: async ({ canvasElement }) => {
    const canvas = await openPreview(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Retry cleanup preview" })).toBeEnabled();
  },
};
export const Confirmation: Story = { play: async ({ canvasElement }) => {
  const canvas = await openPreview(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "Remove eligible records" }));
  const page = within(canvasElement.ownerDocument.body);
  await expect(await page.findByRole("dialog", { name: "Remove archived records?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await userEvent.click(page.getByRole("button", { name: "Remove permanently" }));
  await expect(canvas.queryByText(/1 tasks, 0 artifacts/)).not.toBeInTheDocument();
} };

export const Immediate: Story = {
  beforeEach: () => {
    globalThis.fetch = async (input, options) => {
      if (options?.method === "POST") {
        await expect(JSON.parse(String(options.body)).retentionDays).toBe(0);
        return Response.json({ counts: preview.counts });
      }
      await expect(String(input)).toContain("retentionDays=0");
      return Response.json({ ...preview, retentionDays: 0 });
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText("Retention period"), "0");
    await Confirmation.play!({ canvasElement } as Parameters<NonNullable<typeof Confirmation.play>>[0]);
  },
};
