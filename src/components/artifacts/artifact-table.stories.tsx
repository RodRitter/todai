import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Artifact } from "@/domain/artifact";
import { ArtifactTable } from "./artifact-table";

const base: Artifact = {
  id: "notes", revisionId: "notes-r2", revisionNumber: 2, workspaceId: "workspace", archived: false,
  title: "Project notes", description: "Detailed project notes, shown only when opened.", type: "markdown", creator: "Alice",
  createdAt: "2026-11-15T10:00:00Z", updatedAt: "2026-11-17T10:00:00Z", filename: "notes.md", mediaType: "text/markdown", byteSize: 120, url: null,
};
const artifacts: Artifact[] = [base,
  { ...base, id: "design", revisionId: "design-r1", revisionNumber: 1, title: "Design proposal with a very long name that stays on a single compact row", type: "file", creator: "Morgan", filename: "design.pdf", mediaType: "application/pdf" },
  { ...base, id: "reference", revisionId: "reference-r1", revisionNumber: 1, title: "Reference documentation", type: "link", creator: "Reviewer", url: "https://example.com", filename: null, mediaType: null, byteSize: null },
];
const meta = {
  title: "Artifacts/Table",
  component: ArtifactTable,
  args: { artifacts, onEdit: fn(), onHistory: fn(), onArchive: fn() },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ArtifactTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Narrow: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } };
export const Busy: Story = { args: { busy: true } };
export const RevisionHistory: Story = { args: { artifacts: [base, { ...base, revisionId: "notes-r1", revisionNumber: 1 }], label: "Artifact revisions", onEdit: undefined, onHistory: undefined, onArchive: undefined } };
export const Actions: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Actions for Project notes" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Revision history" }));
    await expect(args.onHistory).toHaveBeenCalledWith(base);
  },
};
export const OpenDetails: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open Reference documentation, revision 1" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(dialog.getByText("Document details"));
    await expect(dialog.getByText(base.description)).toBeInTheDocument();
    await expect(dialog.getByRole("link", { name: "Open external link ↗" })).toHaveAttribute("href", "https://example.com");
  },
};
