import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ConversationMessage } from "./conversation-message";

const meta = {
  title: "Conversation/Shared message",
  component: ConversationMessage,
  args: {
    variant: "chat",
    message: { id: "message", taskId: "task", authorName: "Human", createdAt: "2026-11-20T10:00:00Z",
      body: "## Result\n\nThe change is ready.\n\n- Preserve **Markdown**.\n- Keep `messageId`.\n\n```ts\nconst ready = true;\n```" },
  },
  render: (args) => <div className="space-y-8">
    <section aria-label="Chat presentation"><ConversationMessage {...args} variant="chat" /></section>
    <section aria-label="Comment presentation"><ConversationMessage {...args} variant="comment" /></section>
  </div>,
} satisfies Meta<typeof ConversationMessage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SharedFormatting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ["Chat presentation", "Comment presentation"]) {
      const region = canvas.getByRole("region", { name });
      await expect(within(region).getByRole("heading", { name: "Result" })).toBeVisible();
      await expect(within(region).getAllByRole("listitem")).toHaveLength(2);
      await expect(region.querySelector("pre code")).toHaveTextContent("const ready = true;");
    }
    const chat = canvas.getByRole("region", { name: "Chat presentation" });
    const comment = canvas.getByRole("region", { name: "Comment presentation" });
    await expect(chat.querySelector('[data-slot="message"]')).toHaveAttribute("data-align", "end");
    await expect(chat.querySelector('[data-slot="bubble"]')).toHaveAttribute("data-variant", "muted");
    await expect(within(chat).queryByText("Human")).not.toBeInTheDocument();
    await expect(comment.querySelector('[data-slot="message"]')).toHaveAttribute("data-align", "start");
    await expect(comment.querySelector('[data-slot="bubble"]')).toHaveAttribute("data-variant", "ghost");
    await expect(within(comment).getByText("Human")).toBeVisible();
  },
};
export const Narrow: Story = { ...SharedFormatting, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const Dark: Story = { ...SharedFormatting, globals: { theme: "dark" } };
