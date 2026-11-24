import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MemoryContent } from "./memory-page";
import type { MemorySearchResult } from "@/domain/memory";

const snapshot: MemorySearchResult = {
  entries: [{ id: "entry", revision: 1, category: "Practices", title: "Settings feedback", statement: "Use shared toast helpers for settings feedback.", scope: "Workspace settings", source: "[Source task](/?board=board&task=task)", updatedAt: "2026-11-24T08:00:00Z" }],
  total: 1, hasMore: false,
};
const meta = {
  title: "Memory/Workspace memory", component: MemoryContent,
  parameters: { layout: "fullscreen" }, args: { load: fn(async () => snapshot) },
} satisfies Meta<typeof MemoryContent>;
export default meta;
type Story = StoryObj<typeof MemoryContent>;
export const Accepted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = await canvas.findByRole("button", { name: "Settings feedback" });
    await expect(title).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(title);
    await expect(canvas.getByRole("link", { name: "Source task" })).toHaveAttribute("href", "/?board=board&task=task");
    await expect(canvas.getByRole("heading", { name: "Workspace Memory" })).toBeVisible();
  },
};
export const Search: Story = {
  args: { load: fn(async (query) => query === "missing" ? { entries: [], total: 0, hasMore: false } : snapshot) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("button", { name: "Settings feedback" });
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search memory" }), "missing");
    await expect(await canvas.findByText("No matching memory entries.")).toBeVisible();
    await userEvent.clear(canvas.getByRole("searchbox", { name: "Search memory" }));
    await expect(await canvas.findByRole("button", { name: "Settings feedback" })).toBeVisible();
  },
};
export const Empty: Story = {
  args: { load: fn(async () => ({ entries: [], total: 0, hasMore: false })) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("No memory has been recorded yet.")).toBeVisible();
  },
};
export const Loading: Story = { args: { load: () => new Promise<MemorySearchResult>(() => {}) } };
export const Retry: Story = {
  args: { load: fn().mockRejectedValueOnce(new Error("Could not load workspace memory. Try again.")).mockResolvedValue(snapshot) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Retry" }));
    await expect(await canvas.findByRole("button", { name: "Settings feedback" })).toBeVisible();
  },
};
export const Pagination: Story = {
  args: { load: fn(async (_query, offset) => ({ entries: offset ? [{ ...snapshot.entries[0], id: "next", title: "Next entry" }] : snapshot.entries, total: 21, hasMore: !offset })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await expect(await canvas.findByRole("button", { name: "Next entry" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(await canvas.findByRole("button", { name: "Settings feedback" })).toBeVisible();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
export const NarrowLongContent: Story = {
  args: { load: async () => ({ ...snapshot, entries: [{ ...snapshot.entries[0], title: "WorkspaceScopedPersistentMemory".repeat(3), statement: "Use the shared settings rules. ".repeat(20) }] }) },
  decorators: [(Story) => <div className="max-w-80"><Story /></div>],
};

export const ClearMemory: Story = {
  args: { clear: fn(async () => ({ cleared: 1 })), load: fn().mockResolvedValueOnce(snapshot).mockResolvedValue({ entries: [], total: 0, hasMore: false }) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("button", { name: "Settings feedback" });
    await userEvent.click(canvas.getByRole("button", { name: "Clear memory" }));
    const dialog = within(await body.findByRole("dialog", { name: "Clear workspace memory?" }));
    await expect(args.clear).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(args.clear).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Clear memory" }));
    await userEvent.click(within(await body.findByRole("dialog")).getByRole("button", { name: "Clear memory" }));
    await expect(await canvas.findByText("No memory has been recorded yet.")).toBeVisible();
    await expect(args.clear).toHaveBeenCalledTimes(1);
  },
};
export const ClearFailure: Story = {
  args: { clear: fn(async () => { throw new Error("Could not clear workspace memory. Try again."); }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("button", { name: "Settings feedback" });
    await userEvent.click(canvas.getByRole("button", { name: "Clear memory" }));
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Clear memory" }));
    await expect(dialog.getByRole("button", { name: "Clear memory" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Settings feedback" })).toBeVisible();
  },
};
export const Clearing: Story = {
  args: { clear: () => new Promise<{ cleared: number }>(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("button", { name: "Settings feedback" });
    await userEvent.click(canvas.getByRole("button", { name: "Clear memory" }));
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Clear memory" }));
    await expect(dialog.getByRole("button", { name: "Clearing…" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  },
};
