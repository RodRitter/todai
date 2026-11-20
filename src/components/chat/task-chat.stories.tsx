import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ChatConversation } from "./task-chat";
import type { ChatSession } from "@/domain/chat";

const session: ChatSession = {
  id: "chat", taskId: "task", createdAt: "2026-11-20T10:00:00Z", updatedAt: "2026-11-20T10:02:00Z", running: false, error: null,
  messages: [
    { id: "one", taskId: "task", authorName: "Human", body: "@Reviewer which check do you mean?", createdAt: "2026-11-20T10:01:00Z" },
    { id: "two", taskId: "task", authorName: "Reviewer", body: "Check that a chat message does not enter the task context.\n\n1. Start a chat.\n2. Send a message.\n3. Inspect the task comments.", createdAt: "2026-11-20T10:02:00Z" },
  ],
};
const meta = { title: "Chat/Conversation", component: ChatConversation, parameters: { layout: "padded" },
  args: { session, busy: false, onSend: async () => {}, onDelete: async () => {}, onClear: async () => {}, body: "", onBodyChange: () => {} },
  render: function Example(args) {
    const [body, setBody] = useState(args.body);
    const [current, setCurrent] = useState(args.session);
    return <ChatConversation {...args} session={current} body={body} onBodyChange={setBody}
      onDelete={async (id) => { await args.onDelete(id); setCurrent((value) => ({ ...value, messages: value.messages.filter((message) => message.id !== id) })); }}
      onClear={async () => { await args.onClear(); setCurrent((value) => ({ ...value, messages: [], error: null })); }} />;
  },
} satisfies Meta<typeof ChatConversation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Conversation: Story = { play: async ({ canvasElement }) => {
  const messages = within(canvasElement).getByRole("list", { name: "Chat messages, newest first" });
  await expect(messages.children).toHaveLength(2);
  await expect(messages.children[0]).toHaveTextContent("Check that a chat message does not enter the task context.");
} };
export const Empty: Story = {
  args: { session: { ...session, messages: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Start a conversation" })).toBeVisible();
    await expect(canvas.getByText(/to choose an agent/)).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Your chat message" })).toBeVisible();
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
  },
};
export const EmptyNarrow: Story = { ...Empty, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const EmptyDark: Story = { ...Empty, globals: { theme: "dark" } };
export const EmptyRunning: Story = {
  args: { session: { ...session, messages: [], running: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("heading", { name: "Start a conversation" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};
export const Running: Story = { args: { session: { ...session, running: true } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("status")).toHaveTextContent("Processing chat message");
  await expect(canvas.getByRole("button", { name: "Send chat message" })).toBeDisabled();
  await expect(canvas.getByRole("button", { name: "Clear chat" })).toBeDisabled();
  for (const button of canvas.getAllByRole("button", { name: "Delete chat message" })) await expect(button).toBeDisabled();
} };
export const Failed: Story = { args: { session: { ...session, error: "The response failed. Send a message to retry." } } };
export const FailedSend: Story = {
  args: { body: "Keep this draft", onSend: async () => { throw new Error("Could not send the message."); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Send chat message" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Could not send the message.");
    await expect(canvas.getByRole("textbox", { name: "Your chat message" })).toHaveTextContent("Keep this draft");
  },
};
export const Narrow: Story = { decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const Dark: Story = { decorators: [(Story) => <div className="dark bg-background p-4 text-foreground"><Story /></div>] };

export const LongMessage: Story = { args: { session: { ...session, messages: [{ ...session.messages[1], body: "Long message: " + "content".repeat(120) }] } } };

export const DeleteMessage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const buttons = canvas.getAllByRole("button", { name: "Delete chat message" });
    await userEvent.click(buttons[0]);
    let confirmation = within(await body.findByRole("alertdialog"));
    await userEvent.click(confirmation.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getAllByRole("button", { name: "Delete chat message" })).toHaveLength(2);
    await expect(buttons[0]).toHaveFocus();
    await userEvent.click(buttons[0]);
    confirmation = within(await body.findByRole("alertdialog"));
    await userEvent.click(confirmation.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(canvas.getAllByRole("button", { name: "Delete chat message" })).toHaveLength(1));
    await expect(canvas.getByRole("list")).toHaveTextContent("@Reviewer which check do you mean?");
  },
};
export const ClearChat: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clear chat" }));
    const confirmation = within(await within(canvasElement.ownerDocument.body).findByRole("alertdialog"));
    await expect(confirmation.getByText(/Delete all messages/)).toBeVisible();
    await userEvent.click(confirmation.getByRole("button", { name: "Clear chat" }));
    await waitFor(() => expect(canvas.queryByRole("list")).not.toBeInTheDocument());
    await expect(canvas.getByRole("heading", { name: "Start a conversation" })).toBeVisible();
  },
};
export const FailedDelete: Story = {
  args: { onDelete: async () => { throw new Error("Could not delete the message."); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Delete chat message" })[0]);
    const confirmation = within(await within(canvasElement.ownerDocument.body).findByRole("alertdialog"));
    await userEvent.click(confirmation.getByRole("button", { name: "Delete" }));
    await expect(await confirmation.findByRole("alert")).toHaveTextContent("Could not delete the message.");
    await expect(canvas.getAllByRole("button", { name: "Delete chat message", hidden: true })).toHaveLength(2);
  },
};

export const AllReferences: Story = {
  args: {
    session: { ...session, messages: [] }, onSend: fn(async () => {}),
    agents: [{ id: "reviewer", name: "Reviewer", tool: "codex", model: "test", effort: "low", permissions: "read-only", instructions: "Review changes." }],
  },
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url.startsWith("/api/artifacts?")) return Response.json([{ id: "notes", revisionId: "r1", revisionNumber: 1, title: "Notes", type: "markdown" }]);
      if (url.startsWith("/api/references?")) {
        const skill = url.includes("kind=skill");
        return Response.json({ references: [{ kind: skill ? "skill" : "file", label: skill ? "$review" : "/src/app.ts", path: skill ? "/skills/review/SKILL.md" : "/src/app.ts", detail: skill ? "Review changes" : "Source file" }] });
      }
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox", { name: "Your chat message" });
    for (const [trigger, name] of [["@Rev", /@Reviewer/], ["#Not", /Notes.*Revision/], ["$rev", /\$review/], ["/src", /\/src\/app.ts/]] as const) {
      await userEvent.type(editor, trigger);
      await page.findByRole("option", { name });
      await userEvent.keyboard("{Enter}");
      await expect(args.onSend).not.toHaveBeenCalled();
    }
    await userEvent.click(canvas.getByRole("button", { name: "Send chat message" }));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("#agent/reviewer"));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("#artifact/notes/r1"));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("/skills/review/SKILL.md"));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("/src/app.ts"));
  },
};
