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
  decorators: [(Story) => <div className="flex h-[600px] min-h-0 flex-col"><Story /></div>],
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
  const messages = within(canvasElement).getByRole("list", { name: "Chat messages, oldest first" });
  await expect(messages.children).toHaveLength(2);
  await expect(messages.querySelector("time")).toBeNull();
  await expect(messages.children[0].querySelector('[data-slot="message"]')).toHaveAttribute("data-align", "end");
  await expect(messages.children[0].querySelector('[data-slot="bubble"]')).toHaveAttribute("data-variant", "muted");
  await expect(messages.children[1].querySelector('[data-slot="bubble"]')).toBeNull();
  const personalRow = messages.children[0].querySelector('[data-slot="message-bubble-row"]');
  await expect(personalRow?.firstElementChild).toHaveAttribute("aria-label", "Delete chat message");
  await expect(personalRow?.lastElementChild).toHaveAttribute("data-slot", "bubble");
  await expect(within(messages).queryByText("Human", { exact: true })).not.toBeInTheDocument();
  await userEvent.hover(within(messages).getByText("Reviewer", { exact: true }));
  await expect(await within(canvasElement.ownerDocument.body).findByRole("tooltip")).toHaveTextContent(new Date(session.messages[1].createdAt).toLocaleString());
  await userEvent.unhover(within(messages).getByText("Reviewer", { exact: true }));
  await expect(messages.children[1]).toHaveTextContent("Check that a chat message does not enter the task context.");
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
  await expect(canvas.getByRole("status")).toHaveTextContent("The agent is working");
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
    let confirmation = within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
    await userEvent.click(confirmation.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getAllByRole("button", { name: "Delete chat message" })).toHaveLength(2);
    await expect(buttons[0]).toHaveFocus();
    await userEvent.click(buttons[0]);
    confirmation = within(await body.findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
    await userEvent.click(confirmation.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(canvas.getAllByRole("button", { name: "Delete chat message" })).toHaveLength(1));
    await expect(canvas.getByRole("list")).toHaveTextContent("Check that a chat message does not enter the task context.");
  },
};
export const ClearChat: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clear chat" }));
    const confirmation = within(await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
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
    const confirmation = within(await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: /^(Delete|Clear|Archive)/ }));
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
      if (url.startsWith("/api/artifacts?")) return Response.json([{ id: "notes", title: "Notes", type: "markdown" }]);
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
    for (const [trigger, name] of [["@Rev", /@Reviewer/], ["#Not", /Notes.*markdown/], ["$rev", /\$review/], ["/src", /\/src\/app.ts/]] as const) {
      await userEvent.type(editor, trigger);
      await page.findByRole("option", { name });
      await userEvent.keyboard("{Enter}");
      await expect(args.onSend).not.toHaveBeenCalled();
    }
    await userEvent.click(canvas.getByRole("button", { name: "Send chat message" }));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("#agent/reviewer"));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("#artifact/notes"));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("/skills/review/SKILL.md"));
    await expect(args.onSend).toHaveBeenCalledWith(expect.stringContaining("/src/app.ts"));
  },
};

export const Sending: Story = {
  args: { session: { ...session, messages: [] }, body: "Show this message immediately", onSend: () => new Promise<void>(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Send chat message" }));
    await expect(canvas.getByRole("list", { name: "Chat messages, oldest first" })).toHaveTextContent("Show this message immediately");
    await expect(canvas.getByRole("textbox", { name: "Your chat message" })).not.toHaveTextContent("Show this message immediately");
    await expect(canvas.getByRole("status")).toHaveTextContent("The agent is queued to start.");
    await expect(canvas.getByRole("button", { name: "Send chat message" })).toBeDisabled();
  },
};

export const LongHumanMessage: Story = { args: { session: { ...session, messages: [{ ...session.messages[0], body: "Long message: " + "content".repeat(120) }] } }, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };

export const FixedComposer: Story = {
  args: { session: { ...session, messages: Array.from({ length: 20 }, (_, index) => ({ ...session.messages[index % 2], id: `message-${index}` })) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox", { name: "Your chat message" });
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight));
    const top = editor.getBoundingClientRect().top;
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await expect(editor).toBeVisible();
    await expect(editor.getBoundingClientRect().top).toBe(top);
    await expect(editor.getBoundingClientRect().top).toBeGreaterThanOrEqual(viewport.getBoundingClientRect().bottom);
  },
};

export const ScrollOnArrivalAndTab: Story = {
  render: function Example(args) {
    const [active, setActive] = useState(true);
    const [current, setCurrent] = useState({ ...session, messages: Array.from({ length: 20 }, (_, index) => ({ ...session.messages[index % 2], id: `message-${index}` })) });
    return <>
      <button onClick={() => setActive((value) => !value)}>Switch chat tab</button>
      <button onClick={() => setCurrent((value) => ({ ...value, messages: [...value.messages, { ...session.messages[1], id: crypto.randomUUID() }] }))}>Add chat response</button>
      <button onClick={() => setCurrent((value) => ({ ...value, messages: [...value.messages] }))}>Refresh chat</button>
      <button onClick={() => setCurrent((value) => ({ ...value, messages: value.messages.map((message, index) => index === value.messages.length - 1 ? { ...message, body: message.body + "\n\n" + "Additional response content.\n\n".repeat(20) } : message) }))}>Grow existing response</button>
      <div className={active ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <ChatConversation {...args} session={current} active={active} />
      </div>
    </>;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const atBottom = () => expect(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop).toBeLessThan(2);
    await waitFor(atBottom);
    viewport.scrollTop = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Refresh chat" }));
    await expect(viewport.scrollTop).toBe(0);
    await userEvent.click(canvas.getByRole("button", { name: "Add chat response" }));
    await waitFor(atBottom);
    viewport.scrollTop = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Grow existing response" }));
    await waitFor(atBottom);
    // A late-loading element can change height without a message update.
    const content = viewport.querySelector("ol")!.parentElement!;
    const lateContent = canvasElement.ownerDocument.createElement("div");
    lateContent.style.height = "200px";
    content.append(lateContent);
    await waitFor(atBottom);
    lateContent.style.height = "400px";
    await waitFor(atBottom);
    lateContent.remove();
    await waitFor(atBottom);
    viewport.scrollTop = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Switch chat tab" }));
    await userEvent.click(canvas.getByRole("button", { name: "Switch chat tab" }));
    await waitFor(atBottom);
  },
};
