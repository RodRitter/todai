import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ConfigurationTransfer } from "./configuration-transfer";
import type { Configuration } from "@/domain/configuration";

const configuration: Configuration = {
  format: "todai-configuration", version: 1, agents: [], columns: [], assignments: [],
  memory: { entries: [{ id: "decision", revision: 1, category: "Decisions", title: "Keep source evidence with accepted workspace decisions", statement: "Keep evidence.", scope: "Workspace", source: "User", updatedAt: "2026-11-27" }], tasks: [], artifacts: [] },
};
const meta = {
  title: "Tasks/Configuration transfer",
  component: ConfigurationTransfer,
  args: { onImported: fn() },
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (String(input) === "/api/boards") return Response.json([
        { id: "planning", name: "Planning", description: "", columns: ["Ready"] },
        { id: "delivery", name: "Delivery", description: "", columns: ["Build", "Ship"] },
      ]);
      if (String(input).startsWith("/api/configuration")) {
        if (options?.method === "POST") return Response.json({ agents: 0, columns: 0, assignments: 0, memory: 1 });
        const boardId = new Headers(options?.headers).get("X-Todai-Board");
        if (boardId === "planning") return Response.json({ ...configuration, columns: [{ id: "ready", name: "Ready" }] });
        if (boardId === "delivery") return Response.json({ ...configuration, columns: [{ id: "build", name: "Build" }, { id: "ship", name: "Ship" }] });
        return Response.json(configuration);
      }
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof ConfigurationTransfer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MemorySelection: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Export board" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByRole("checkbox", { name: configuration.memory!.entries[0].title })).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Export selected" })).toBeEnabled();
    await userEvent.click(dialog.getByRole("button", { name: "Clear memory" }));
    await expect(dialog.getByRole("button", { name: "Export selected" })).toBeEnabled();
    await userEvent.click(dialog.getByRole("button", { name: "Select all memory" }));
    await expect(dialog.getByRole("button", { name: "Export selected" })).toBeEnabled();
  },
};
export const Dark: Story = { ...MemorySelection, globals: { theme: "dark" } };
export const MemoryImport: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText("Import configuration file"), new File([JSON.stringify(configuration)], "memory.json", { type: "application/json" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Import selected" }));
    await expect(args.onImported).toHaveBeenCalled();
  },
};

export const LegacyBoardOrder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const data: Configuration = { format: "todai-configuration", version: 1, agents: [], columns: [], assignments: [], boardOrder: [{ id: "research", name: "Research" }] };
    await userEvent.upload(canvas.getByLabelText("Import configuration file"), new File([JSON.stringify(data)], "order.json", { type: "application/json" }));
    await expect(await canvas.findByRole("button", { name: "Import selected" })).toBeDisabled();
    await expect(canvas.queryByRole("checkbox", { name: "Board order" })).not.toBeInTheDocument();
  },
};

export const WorkspaceFile: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Export workspace" })).toBeVisible();
    const data: Configuration = { ...configuration, boards: [{ id: "board", name: "Planning", columns: [{ id: "ready", name: "Ready" }], assignments: [] }], defaultBoardId: "board" };
    await userEvent.upload(canvas.getByLabelText("Import configuration file"), new File([JSON.stringify(data)], "workspace.json", { type: "application/json" }));
    await expect(await canvas.findByRole("button", { name: "Import workspace" })).toBeEnabled();
    await expect(canvas.getByText("Planning · 1 column")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Import workspace" }));
    await expect(args.onImported).toHaveBeenCalled();
    await expect(canvas.queryByRole("button", { name: "Import selected" })).not.toBeInTheDocument();
  },
};

let downloaded: Blob | null = null;
let downloadedFilename = "";
export const ChooseBoard: Story = {
  beforeEach: () => {
    downloaded = null;
    downloadedFilename = "";
    const create = URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { downloaded = blob as Blob; return create(blob); };
    HTMLAnchorElement.prototype.click = function () { downloadedFilename = this.download; };
    return () => { URL.createObjectURL = create; HTMLAnchorElement.prototype.click = click; };
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Export board" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByLabelText("Board to export")).toHaveValue("planning");
    await expect(dialog.queryByRole("group", { name: "Columns" })).not.toBeInTheDocument();
    await expect(dialog.queryByRole("radiogroup", { name: "Configuration contents" })).not.toBeInTheDocument();
    await userEvent.selectOptions(dialog.getByLabelText("Board to export"), "delivery");
    await expect(dialog.getByLabelText("Board to export")).toHaveValue("delivery");
    await expect(dialog.getByRole("status")).toHaveTextContent("2 columns");
    await userEvent.click(dialog.getByRole("button", { name: "Export selected" }));
    await expect(downloaded).not.toBeNull();
    const data = JSON.parse(await downloaded!.text());
    await expect(data.columns.map((column: { name: string }) => column.name)).toEqual(["Build", "Ship"]);
    await expect(data).not.toHaveProperty("boards");
    await expect(downloadedFilename).toBe("todai-board-delivery.json");
  },
};
export const ChooseBoardDark: Story = { ...ChooseBoard, globals: { theme: "dark" } };

export const WorkspaceImportFailure: Story = {
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/configuration") && options?.method === "POST"
      ? Response.json({ error: "Import failed. Try again." }, { status: 500 })
      : original(input, options);
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const data: Configuration = { ...configuration, boards: [{ id: "board", name: "Planning", columns: [{ id: "ready", name: "Ready" }], assignments: [] }], defaultBoardId: "board" };
    await userEvent.upload(canvas.getByLabelText("Import configuration file"), new File([JSON.stringify(data)], "workspace.json", { type: "application/json" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Import workspace" }));
    await expect(await within(document.body).findByText("Import failed. Try again.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Import workspace" })).toBeEnabled();
    await expect(canvas.getByText("Planning · 1 column")).toBeVisible();
  },
};
export const WorkspaceImportDark: Story = { ...WorkspaceImportFailure, globals: { theme: "dark" } };
