import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { CreateWorkspace } from "./create-workspace";

const meta = {
  title: "Tasks/Fresh setup",
  component: CreateWorkspace,
  args: { firstRun: true },
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/directories?") ? Response.json([]) : original(input, options);
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof CreateWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FreshSetup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Workspace name"), "Project");
    await userEvent.type(canvas.getByLabelText("Project folder"), "/tmp");
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Your name"), "Roderick");
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeEnabled();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };

export const WithImport: Story = {
  args: { firstRun: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const file = new File([JSON.stringify({ format: "todai-configuration", version: 1, agents: [], columns: [{ id: "todo", name: "Ready" }], assignments: [] })], "workspace.json", { type: "application/json" });
    await userEvent.selectOptions(canvas.getByLabelText("Workspace setup"), "import");
    await expect(canvas.queryByRole("group", { name: /Starter agents/ })).not.toBeInTheDocument();
    await userEvent.upload(canvas.getByLabelText("Import configuration"), file);
    await expect((canvas.getByLabelText("Import configuration") as HTMLInputElement).files?.[0]).toBe(file);
  },
};
export const InvalidImport: Story = {
  args: { firstRun: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Workspace name"), "Project");
    await userEvent.type(canvas.getByLabelText("Project folder"), "/tmp");
    await userEvent.selectOptions(canvas.getByLabelText("Workspace setup"), "import");
    await expect(canvas.queryByRole("group", { name: /Starter agents/ })).not.toBeInTheDocument();
    await userEvent.upload(canvas.getByLabelText("Import configuration"), new File(["invalid"], "invalid.json", { type: "application/json" }));
    await userEvent.click(canvas.getByRole("button", { name: "Create workspace" }));
    await expect(await within(document.body).findByText("Choose a valid JSON file.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeEnabled();
  },
};
export const Narrow: Story = { ...WithImport, decorators: [(Story) => <div className="w-80"><Story /></div>] };

export const SetupChoice: Story = {
  args: { firstRun: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Workspace name"), "Project");
    await userEvent.type(canvas.getByLabelText("Project folder"), "/tmp");
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeEnabled();
    await userEvent.selectOptions(canvas.getByLabelText("Workspace setup"), "import");
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeDisabled();
    await expect(canvas.queryByRole("group", { name: /Starter agents/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(canvas.getByLabelText("Workspace setup"), "manual");
    await expect(canvas.queryByLabelText("Import configuration")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Create workspace" })).toBeEnabled();
  },
};
export const ImportDark: Story = { ...WithImport, globals: { theme: "dark" } };
export const ImportSubmission: Story = {
  args: { firstRun: false },
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (String(input) === "/api/workspaces" && options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        await expect(body.configuration.format).toBe("todai-configuration");
        await expect(body).not.toHaveProperty("columns");
        await expect(body).not.toHaveProperty("starterAgentIds");
        return Response.json({ error: "Import request checked." }, { status: 400 });
      }
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Workspace name"), "Imported");
    await userEvent.type(canvas.getByLabelText("Project folder"), "/tmp");
    await userEvent.click(canvas.getByRole("checkbox", { name: /Planner/ }));
    await userEvent.selectOptions(canvas.getByLabelText("Workspace setup"), "import");
    await userEvent.upload(canvas.getByLabelText("Import configuration"), new File([JSON.stringify({ format: "todai-configuration", version: 1, agents: [], columns: [{ id: "ready", name: "Ready" }], assignments: [] })], "workspace.json", { type: "application/json" }));
    await userEvent.click(canvas.getByRole("button", { name: "Create workspace" }));
    await expect(await within(document.body).findByText("Import request checked.")).toBeVisible();
  },
};
