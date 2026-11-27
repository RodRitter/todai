import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { WorkspaceChatView } from "./workspace-chat-view";
import type { WorkspaceChat } from "@/domain/workspace-chat";
const session: WorkspaceChat = { id: "chat", title: "Plan the review board", tool: "codex", model: "gpt-6.1-sol", effort: "medium", createdAt: "2026-11-25T10:00:00Z", updatedAt: "2026-11-25T10:00:00Z", running: false, error: null, activities: [], messages: [] };
const meta = { title: "Chat/Workspace chat", component: WorkspaceChatView, parameters: { layout: "fullscreen" }, args: {
  chats: [session], session, statuses: [], onSelect: fn(), onCreate: fn(), onRename: fn(), onDelete: fn(), onSend: fn(), onModelChange: fn(), onRetry: fn(),
} } satisfies Meta<typeof WorkspaceChatView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("textbox", { name: "Your chat message" }), "Create a review board");
  await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
  await expect(args.onSend).toHaveBeenCalledWith("Create a review board", { tool: "codex", model: "gpt-6.1-sol", effort: "medium" });
} };
export const ModelSelection: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: /Model:/ }));
  await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitemradio", { name: "sonnet" }));
  await userEvent.type(canvas.getByRole("textbox", { name: "Your chat message" }), "Hello");
  await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
  await expect(args.onSend).toHaveBeenCalledWith("Hello", { tool: "claude", model: "sonnet", effort: "medium" });
} };
export const ToolResults: Story = { args: { session: { ...session, messages: [{ id: "human", authorRole: "human", authorName: "Human", body: "Create a review board.", createdAt: session.createdAt }, { id: "reply", authorRole: "agent", authorName: "Assistant", model: session.model, body: "Created **Review** with the standard columns.", createdAt: session.createdAt }], activities: [{ id: "tool", turnId: "human", name: "create_board", input: { name: "Review" }, status: "complete", mutation: true, result: { id: "review", name: "Review" } }] } } };
export const Running: Story = { args: { session: { ...ToolResults.args!.session!, running: true, messages: [ToolResults.args!.session!.messages[0]], activities: [{ ...ToolResults.args!.session!.activities[0], status: "running", result: undefined }] } } };
export const Failure: Story = { args: { session: { ...ToolResults.args!.session!, error: "The response failed. The saved board remains.", activities: [{ ...ToolResults.args!.session!.activities[0], status: "error", result: "Move all tasks before deleting this board." }] } } };
export const LongHistory: Story = { args: { chats: Array.from({ length: 30 }, (_, i) => ({ ...session, id: `chat-${i}`, title: `Conversation ${i + 1} with a long name for the workspace` })), session: { ...session, messages: Array.from({ length: 40 }, (_, i) => ({ id: `message-${i}`, authorRole: i % 2 ? "agent" : "human", authorName: i % 2 ? "Assistant" : "Human", model: session.model, body: `Message ${i + 1}: review the configuration and explain the next step.`, createdAt: session.createdAt })) } } };
export const Unavailable: Story = { args: { statuses: [{ tool: "codex", installed: false, signedIn: false, message: "Codex CLI is unavailable." }] } };
export const Narrow: Story = { ...ToolResults, decorators: [(Story) => <div className="max-w-sm"><Story /></div>] };
export const Dark: Story = { ...ToolResults, globals: { theme: "dark" } };

export const EffortSelection: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Effort: medium" }));
  await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitemradio", { name: /^high$/ }));
  await expect(args.onModelChange).toHaveBeenCalledWith({ tool: "codex", model: "gpt-6.1-sol", effort: "high" });
  await userEvent.type(canvas.getByRole("textbox", { name: "Your chat message" }), "Explain this board");
  await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
  await expect(args.onSend).toHaveBeenCalledWith("Explain this board", { tool: "codex", model: "gpt-6.1-sol", effort: "high" });
} };

export const ReplyTooltip: Story = { ...ToolResults, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const copy = canvas.getByRole("button", { name: "Copy reply" });
  await userEvent.hover(copy);
  await expect(await within(canvasElement.ownerDocument.body).findByRole("tooltip")).toHaveTextContent("Copy reply");
} };
