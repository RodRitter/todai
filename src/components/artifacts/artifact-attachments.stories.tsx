import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Artifact, TaskArtifact } from "@/domain/artifact";
import type { TaskComment } from "@/domain/task";
import { TaskComments } from "@/components/tasks/task-comments";
import { ArtifactPicker, TaskArtifacts } from "./artifact-attachments";

const first: Artifact = {
  id: "evidence", revisionId: "r1", revisionNumber: 1, archived: false, workspaceId: "workspace",
  title: "Original design evidence with a long title that wraps on narrow screens",
  description: "Published evidence", type: "text", creator: "Alice", createdAt: "2026-11-17T10:00:00Z",
  updatedAt: "2026-11-17T10:00:00Z", filename: "evidence.txt", mediaType: "text/plain", byteSize: 8, url: null,
};
const latest = { ...first, title: "Revised design evidence", revisionId: "r2", revisionNumber: 2, creator: "Bob" };
const initialLinks: TaskArtifact[] = [{ artifact: latest, explicit: true, comments: [{ commentId: "comment", artifact: first }] }];

const meta = {
  title: "Artifacts/Attachments",
  component: TaskArtifacts,
  args: { taskId: "task", commentsKey: "comment" },
  parameters: { layout: "padded" },
  beforeEach: (context) => {
    const original = globalThis.fetch;
    let links: TaskArtifact[] = context.parameters.empty ? [] : context.parameters.compactRows ? [
      ...initialLinks,
      { artifact: { ...first, id: "long-title" }, explicit: true, comments: [] },
      { artifact: { ...latest, id: "reference", title: "Research notes", type: "link", url: "https://example.com" }, explicit: true, comments: [] },
      { artifact: { ...first, id: "archived", title: "Earlier proposal", archived: true }, explicit: false, comments: initialLinks[0].comments },
    ] : initialLinks;
    globalThis.fetch = async (input, options) => {
      const url = new URL(String(input), "http://localhost");
      if (!url.pathname.startsWith("/api/artifacts")) return original(input, options);
      if (context.parameters.failure) return Response.json({ error: "Connection lost. Retry to load attachments." }, { status: 503 });
      if (url.pathname.endsWith("/links")) {
        if (options?.method === "DELETE") links = links.map((link) => ({ ...link, explicit: false }));
        if (options?.method === "POST") links = [{ artifact: latest, explicit: true, comments: links[0]?.comments ?? [] }];
        return Response.json(links);
      }
      if (url.pathname.endsWith("/download")) return new Response("Evidence");
      if (url.searchParams.has("id")) return Response.json(url.searchParams.get("revision") === "r1" ? first : latest);
      return Response.json([latest]);
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof TaskArtifacts>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LatestAndPinned: Story = {};
export const TaskTabs: Story = { render: () => <TaskComments taskId="task" comments={[{ id: "comment", taskId: "task", body: "See the original evidence.", authorName: "Human", createdAt: first.createdAt }]} /> };
export const CompactRows: Story = { parameters: { compactRows: true } };
export const NarrowRows: Story = { parameters: { compactRows: true }, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const Empty: Story = { parameters: { empty: true } };
export const LoadError: Story = { parameters: { failure: true } };
export const BusyPicker: Story = { render: () => <ArtifactPicker attachmentIcon disabled onSelect={() => {}} /> };

function Composer() {
  const [comments, setComments] = useState<TaskComment[]>([]);
  return <TaskComments comments={comments} onPostComment={async (body, artifacts) => {
    setComments((items) => [...items, { id: crypto.randomUUID(), taskId: "task", body, artifacts, authorName: "Human", createdAt: new Date().toISOString() }]);
  }} />;
}
export const ComposeWithAttachments: Story = { render: () => <Composer /> };
export const ComposerError: Story = { render: () => <TaskComments onPostComment={async () => { throw new Error("Posting failed. Your draft and attachments are retained."); }} /> };

export const InlineCitation: Story = {
  render: () => <Composer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your comment" });
    await userEvent.click(editor);
    await userEvent.keyboard("#Revised");
    await userEvent.click(await canvas.findByRole("option", { name: /Revised design evidence/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Post comment" }));
    await expect(await canvas.findByRole("button", { name: "Revised design evidence" })).toBeVisible();
    const toolbar = canvas.getByRole("group", { name: "Your comment formatting" });
    await expect(within(toolbar).getByRole("button", { name: "Attach artifact" })).toBeVisible();
  },
};
export const PaperclipLoadError: Story = {
  parameters: { failure: true },
  render: () => <Composer />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Attach artifact" }));
    await expect(await within(document.body).findByRole("alert")).toHaveTextContent("Connection lost");
  },
};

export const OpenPinnedRevision: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /View 1 comment reference/ }));
    await userEvent.click(await within(document.body).findByRole("button", { name: `Open ${first.title}, revision 1` }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(await dialog.findByText("Evidence")).toBeVisible();
    await expect(dialog.getByText("Revision 1", { exact: true })).toBeInTheDocument();
  },
};
