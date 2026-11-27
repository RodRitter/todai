import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { WorkspaceSettingsTab } from "./workspace-settings-tab";

const meta = {
  title: "Tasks/Workspace settings",
  component: WorkspaceSettingsTab,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="mx-auto max-w-7xl p-4"><Story /></div>],
  beforeEach: () => {
    const original = globalThis.fetch;
    let worktreesEnabled = false;
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url.startsWith("/api/workspaces?")) return Response.json([]);
      if (url === "/api/workspace") {
        if (options?.method === "PATCH") worktreesEnabled = JSON.parse(String(options.body)).worktreesEnabled;
        return Response.json({ path: "/projects/todai", worktreesEnabled });
      }
      if (url === "/api/usage") return Response.json({ creditLimit: 100, credits: 25, trackedCredits: 25 });
      if (url.startsWith("/api/directories?")) return Response.json([]);
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof WorkspaceSettingsTab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentWorkspace: Story = {};
export const ArchiveNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Archive workspace" }));
    await expect(canvas.getByRole("button", { name: "Archive this workspace" })).toBeVisible();
    await expect(canvas.queryByRole("switch", { name: "Use task worktrees" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "Directory and worktrees" }));
    await expect(await canvas.findByRole("switch", { name: "Use task worktrees" })).toBeVisible();
  },
};
export const ImportExport: Story = {
  args: { transferSettings: <h2>Transfer configuration files</h2> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = canvas.getByRole("tablist", { name: "Workspace categories" });
    await userEvent.click(within(navigation).getByRole("tab", { name: "Import and export" }));
    await expect(canvas.getByRole("heading", { name: "Transfer configuration files" })).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect(within(navigation).getByRole("tab", { name: "Cleanup" })).toHaveFocus();
  },
};
export const WorktreeSetting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("switch", { name: "Use task worktrees" });
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
  },
};

export const Narrow: Story = { decorators: [(Story) => <div className="w-80"><Story /></div>] };
export const Dark: Story = { globals: { theme: "dark" } };
