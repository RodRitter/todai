import { useState } from "react";
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
    let links = context.parameters.empty ? [] : initialLinks;
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
export const Empty: Story = { parameters: { empty: true } };
export const LoadError: Story = { parameters: { failure: true } };
export const BusyPicker: Story = { render: () => <ArtifactPicker disabled onSelect={() => {}} /> };

function Composer() {
  const [comments, setComments] = useState<TaskComment[]>([]);
  return <TaskComments comments={comments} onPostComment={async (body, artifacts) => {
    setComments((items) => [...items, { id: crypto.randomUUID(), taskId: "task", body, artifacts, authorName: "Human", createdAt: new Date().toISOString() }]);
  }} />;
}
export const ComposeWithAttachments: Story = { render: () => <Composer /> };
export const ComposerError: Story = { render: () => <TaskComments onPostComment={async () => { throw new Error("Posting failed. Your draft and attachments are retained."); }} /> };
