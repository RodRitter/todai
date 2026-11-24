import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { WorkspaceSettingsTab } from "./workspace-settings-tab";

let finishCreation: (() => void) | undefined;
const meta = {
  title: "Tasks/Workspace settings",
  component: WorkspaceSettingsTab,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="mx-auto max-w-2xl p-4"><Story /></div>],
  beforeEach: () => {
    const original = globalThis.fetch;
    finishCreation = undefined;
    let worktreesEnabled = false;
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url === "/api/workspaces" && options?.method === "POST") {
        await new Promise<void>((resolve) => { finishCreation = resolve; });
        return Response.json({ error: "A workspace already uses this folder." }, { status: 409 });
      }
      if (url.startsWith("/api/workspaces?")) return Response.json([]);
      if (url === "/api/workspace") {
        if (options?.method === "PATCH") worktreesEnabled = JSON.parse(String(options.body)).worktreesEnabled;
        return Response.json({ path: "/projects/todai", worktreesEnabled });
      }
      if (url.startsWith("/api/directories?")) return Response.json([]);
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof WorkspaceSettingsTab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentWorkspace: Story = {};
export const LocalNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", { name: "Workspace breadcrumbs" })).toHaveTextContent("Current workspace");
    await expect(canvas.queryByLabelText("Workspace name")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "New" }));
    await expect(canvas.getByRole("navigation", { name: "Workspace breadcrumbs" })).toHaveTextContent("Current workspaceNew workspace");
    await expect(canvas.queryByLabelText("Directory", { exact: true })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Archive this workspace" })).not.toBeInTheDocument();
    await userEvent.type(canvas.getByLabelText("Workspace name"), "Draft project");
    await userEvent.click(canvas.getByRole("button", { name: "Current workspace" }));
    await expect(await canvas.findByLabelText("Directory", { exact: true })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Archived" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "New" }));
    await expect(canvas.getByLabelText("Workspace name")).toHaveValue("");
  },
};
export const ArchiveNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("heading", { name: "Archived workspaces" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Archive this workspace" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Archived" }));
    await expect(canvas.getByRole("navigation", { name: "Workspace breadcrumbs" })).toHaveTextContent("Current workspaceArchived");
    await expect(canvas.getByRole("heading", { name: "Archived workspaces" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Archive this workspace" })).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText("Directory", { exact: true })).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText("Workspace name")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Current workspace" }));
    await expect(await canvas.findByLabelText("Directory", { exact: true })).toBeVisible();
    await expect(canvas.queryByRole("heading", { name: "Archived workspaces" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Archive this workspace" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "New" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Archived" })).toBeVisible();
  },
};
export const CreationFailure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "New" }));
    await userEvent.type(canvas.getByLabelText("Workspace name"), "New project");
    await userEvent.type(canvas.getByLabelText("Project folder"), "/projects/todai");
    await userEvent.click(canvas.getByRole("button", { name: "Create workspace" }));
    await expect(canvas.getByRole("button", { name: "Current workspace" })).toBeDisabled();
    finishCreation?.();
    await expect(await canvas.findByRole("alert")).toHaveTextContent("already uses this folder");
    await expect(canvas.getByLabelText("Workspace name")).toHaveValue("New project");
    await expect(canvas.getByRole("button", { name: "Current workspace" })).toBeEnabled();
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
