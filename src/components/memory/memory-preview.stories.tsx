import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { MemoryChangePreview } from "./memory-preview";
import type { MemoryEntry } from "@/domain/memory";
const entry: MemoryEntry = { id: "one", revision: 1, title: "Release checks", category: "Practices", statement: "Run lint before release.", scope: "Production releases", source: "[Source task](/?task=one)", updatedAt: "2026-11-24T08:00:00Z" };
const meta = {
  title: "Memory/Approval preview", component: MemoryChangePreview,
  args: { changes: [
    { operation: "add", reason: "The task established the settings rule.", after: { ...entry, id: "two", title: "Settings feedback", statement: "Use shared toast helpers." } },
    { operation: "update", reason: "The task added a type check.", before: entry, after: { ...entry, revision: 2, statement: "Run lint and type checks before release." } },
    { operation: "remove", reason: "The procedure is retired.", before: { ...entry, id: "three", title: "Legacy deployment", statement: "Use the legacy deployment script." } },
  ] },
} satisfies Meta<typeof MemoryChangePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Changes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Change — Release checks")).toBeVisible();
    const details = canvas.getByRole("button", { name: "Details: Release checks" });
    details.focus();
    await userEvent.keyboard("{Enter}");
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText("Run lint before release.")).toBeVisible();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
export const Narrow: Story = { decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
