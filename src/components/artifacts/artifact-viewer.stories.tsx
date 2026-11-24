import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Artifact } from "@/domain/artifact";
import { ArtifactOpenButton } from "./artifact-attachments";

const artifact: Artifact = {
  id: "preview", workspaceId: "workspace", archived: false,
  title: "Original evidence", description: "A document preview", type: "markdown", creator: "Alice",
  createdAt: "2026-11-17T10:00:00Z", updatedAt: "2026-11-17T10:00:00Z", filename: "notes.md", mediaType: "text/markdown", byteSize: 80, url: null,
};
const meta = {
  title: "Artifacts/Viewer",
  component: ArtifactOpenButton,
  args: { artifact },
  beforeEach: (context) => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (String(input).startsWith("/api/artifacts?")) return Response.json(context.args.artifact);
      if (!String(input).includes("/api/artifacts/download")) return original(input, options);
      if (context.parameters.loading) return new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      if (context.parameters.failure) return Response.json({ error: "Stored content is unavailable." }, { status: 400 });
      if (context.parameters.image) return new Response(Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII="), (char) => char.charCodeAt(0)), { headers: { "Content-Type": "image/png" } });
      return new Response(context.parameters.scrollContent ?? (context.parameters.document ? "# A quieter workspace\n\nA proposal for making shared knowledge easier to find, read, and reuse.\n\n## The goal\n\nGive every artifact a clear place in the workspace. The library should be easy to scan, while opening a document should feel like settling into a focused reading space.\n\n> Good presentation gives the content room to speak.\n\n## What changes\n\n1. Keep the library compact and searchable.\n2. Present written work as a document.\n3. Keep downloads within reach.\n\n### Delivery checklist\n\n- [x] Compact artifact table\n- [x] Dedicated document preview\n- [ ] Share with the team\n\n| Area | Approach |\n| --- | --- |\n| Library | Essential information only |\n| Preview | Content first, details on demand |\n\n---\n\nUse `artifact.id` to link to the document.\n\n```ts\nconst reference = {\n  artifactId: artifact.id,\n};\n```" : context.parameters.empty ? "" : context.parameters.long ? "A long line of evidence. ".repeat(800) : "# Original evidence\n\nThis is the document.\n\n<script>alert('unsafe')</script>\n\n[Unsafe link](javascript:alert(1))"));
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
export const DocumentNarrow: Story = { ...Document, globals: { viewport: { value: "mobile1", isRotated: false } } };
export const DocumentDark: Story = { ...Document, globals: { theme: "dark" } };
export const PlainText: Story = { args: { artifact: { ...artifact, type: "text", mediaType: "text/plain" } } };
export const Empty: Story = { parameters: { empty: true } };
export const LongContent: Story = {
  parameters: { long: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    const dialog = await within(document.body).findByRole("dialog");
    await within(dialog).findByRole("article", { name: "Markdown document" });
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    const header = dialog.querySelector<HTMLElement>('[data-slot="dialog-header"]')!;
    await expect(within(dialog).queryByLabelText("Artifact details")).not.toBeInTheDocument();
    const viewport = dialog.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const top = header.getBoundingClientRect().top;
    viewport.scrollTop = 240;
    await waitFor(() => {
      expect(viewport.scrollTop).toBeGreaterThan(0);
      expect(Math.abs(header.getBoundingClientRect().top - top)).toBeLessThanOrEqual(1);
    });
    await expect(within(header).getByRole("button", { name: "Download" })).toBeVisible();
  },
};
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
    await waitFor(() => expect(dialog.getByText("This is the document.")).toBeVisible());
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const LongTitle: Story = {
  args: { artifact: { ...artifact, title: "Evidence from the workspace review with a long title that wraps across multiple lines" } },
};
export const Dark: Story = { globals: { theme: "dark" } };

export const Archived: Story = {
  args: { artifact: { ...artifact, archived: true } },
};
export const MetadataWithoutDescription: Story = {
  args: { artifact: { ...artifact, description: "", filename: null } },
};

export const SubtleDocumentHeader: Story = {
  ...Document,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    const dialog = await within(document.body).findByRole("dialog");
    const header = dialog.querySelector<HTMLElement>('[data-slot="dialog-header"]')!;
    await expect(within(header).getByLabelText("Document type: Markdown")).toBeVisible();
    await expect(within(header).getByRole("heading", { name: "A quieter workspace" })).toBeVisible();
    await expect(within(header).queryByRole("textbox")).not.toBeInTheDocument();
    await expect(await within(dialog).findByRole("heading", { name: "A quieter workspace", level: 1 })).toBeVisible();
  },
};

const checkNestedScroll: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
  const dialog = await within(document.body).findByRole("dialog");
  await waitFor(() => expect(dialog.querySelectorAll('[data-slot="scroll-area-viewport"]')).toHaveLength(2));
  const [outer, inner] = dialog.querySelectorAll<HTMLElement>('[data-slot="scroll-area-viewport"]');
  await expect(outer.scrollHeight).toBeGreaterThan(outer.clientHeight);
  await expect(getComputedStyle(inner).overscrollBehaviorY).toBe("auto");
};
const scrollTail = "\n\nMore document content.\n\n".repeat(30);
export const ScrollTable: Story = {
  play: checkNestedScroll,
  parameters: { scrollContent: "| Check | Result |\n| --- | --- |\n| " + "Wide_column_".repeat(30) + " | Passed |" + scrollTail },
};
export const ScrollShortCode: Story = {
  play: checkNestedScroll,
  parameters: { scrollContent: "```ts\nconst ready = true;\n```" + scrollTail },
};
export const ScrollLongCode: Story = {
  play: checkNestedScroll,
  parameters: { scrollContent: "```text\n" + Array.from({ length: 50 }, (_, i) => `Line ${i}: ${"Output ".repeat(40)}`).join("\n") + "\n```" + scrollTail },
};
