import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Artifact } from "@/domain/artifact";
import { ArtifactOpenButton } from "./artifact-attachments";

const artifact: Artifact = {
  id: "preview", revisionId: "original", revisionNumber: 1, workspaceId: "workspace", archived: false,
  title: "Original evidence", description: "An exact revision preview", type: "markdown", creator: "Alice",
  createdAt: "2026-11-17T10:00:00Z", updatedAt: "2026-11-17T10:00:00Z", filename: "notes.md", mediaType: "text/markdown", byteSize: 80, url: null,
};
const meta = {
  title: "Artifacts/Viewer",
  component: ArtifactOpenButton,
  args: { artifact },
  beforeEach: (context) => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (!String(input).includes("/api/artifacts/download")) return original(input, options);
      if (context.parameters.loading) return new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      if (context.parameters.failure) return Response.json({ error: "Stored content is unavailable." }, { status: 400 });
      if (context.parameters.image) return new Response(Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII="), (char) => char.charCodeAt(0)), { headers: { "Content-Type": "image/png" } });
      return new Response(context.parameters.document ? "# A quieter workspace\n\nA proposal for making shared knowledge easier to find, read, and reuse.\n\n## The goal\n\nGive every artifact a clear place in the workspace. The library should be easy to scan, while opening a document should feel like settling into a focused reading space.\n\n> Good presentation gives the content room to speak.\n\n## What changes\n\n1. Keep the library compact and searchable.\n2. Present written work as a document.\n3. Keep revisions and downloads within reach.\n\n### Delivery checklist\n\n- [x] Compact artifact table\n- [x] Dedicated document preview\n- [ ] Share with the team\n\n| Area | Approach |\n| --- | --- |\n| Library | Essential information only |\n| Preview | Content first, details on demand |\n\n---\n\nUse `artifact.revisionId` to preserve an exact reference." : context.parameters.empty ? "" : context.parameters.long ? "A long line of evidence. ".repeat(800) : "# Original evidence\n\nThis is revision one.\n\n<script>alert('unsafe')</script>\n\n[Unsafe link](javascript:alert(1))");
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
} satisfies Meta<typeof ArtifactOpenButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Markdown: Story = {};
export const Document: Story = { args: { artifact: { ...artifact, title: "A quieter workspace" } }, parameters: { document: true } };
export const PlainText: Story = { args: { artifact: { ...artifact, type: "text", mediaType: "text/plain" } } };
export const Empty: Story = { parameters: { empty: true } };
export const LongContent: Story = { parameters: { long: true } };
export const Loading: Story = { parameters: { loading: true } };
export const MissingContent: Story = { parameters: { failure: true } };
export const Image: Story = { args: { artifact: { ...artifact, type: "file", mediaType: "image/png", filename: "screenshot.png" } }, parameters: { image: true } };
export const DamagedPdf: Story = { args: { artifact: { ...artifact, type: "file", mediaType: "application/pdf", filename: "document.pdf" } } };
export const Unsupported: Story = { args: { artifact: { ...artifact, type: "file", mediaType: "text/html", filename: "page.html" } } };
export const ExternalLink: Story = { args: { artifact: { ...artifact, type: "link", url: "https://example.com", filename: null, mediaType: null, byteSize: null } } };
export const OpenAndClose: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await waitFor(() => expect(dialog.getByText("This is revision one.")).toBeVisible());
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};
