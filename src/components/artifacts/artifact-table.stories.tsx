import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Artifact } from "@/domain/artifact";
import { ArtifactTable } from "./artifact-table";

const base: Artifact = {
  id: "notes", workspaceId: "workspace", archived: false,
  title: "Project notes", description: "Detailed project notes, shown only when opened.", type: "markdown", creator: "Alice",
  createdAt: "2026-11-15T10:00:00Z", updatedAt: "2026-11-17T10:00:00Z", filename: "notes.md", mediaType: "text/markdown", byteSize: 120, url: null,
};
const artifacts: Artifact[] = [base,
  { ...base, id: "design", title: "Design proposal with a very long name that stays on a single compact row", type: "file", creator: "Morgan", filename: "design.pdf", mediaType: "application/pdf" },
  { ...base, id: "reference", title: "Reference documentation", type: "link", creator: "Reviewer", url: "https://example.com", filename: null, mediaType: null, byteSize: null },
];
const meta = {
  title: "Artifacts/Table",
  component: ArtifactTable,
  args: { artifacts, onEdit: fn(), onArchive: fn() },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ArtifactTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Narrow: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } };
export const Dark: Story = { globals: { theme: "dark" } };
export const Busy: Story = { args: { busy: true } };
export const Actions: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).queryByRole("columnheader", { name: "Revision" })).not.toBeInTheDocument();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Actions for Project notes" }));
    await expect(within(document.body).queryByRole("menuitem", { name: "Revision history" })).not.toBeInTheDocument();
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Edit" }));
    await expect(args.onEdit).toHaveBeenCalledWith(base);
  },
};
export const OpenDetails: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open Reference documentation" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.queryByLabelText("Artifact details")).not.toBeInTheDocument();
    await expect(dialog.getByRole("link", { name: "Open external link ↗" })).toHaveAttribute("href", "https://example.com");
  },
};
