import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Markdown } from "@/components/ui/markdown";
import { CommentReference, CommentReferenceProvider } from "./comment-reference";

const meta = {
  title: "Tasks/Comment references", component: CommentReference,
  args: { reference: { taskId: "task", commentId: "source" }, children: "Comment by Reviewer" },
} satisfies Meta<typeof CommentReference>;
export default meta;
type Story = StoryObj<typeof meta>;
export const References: Story = {
  render: () => <CommentReferenceProvider taskId="task" onNavigate={fn()}>
    <Markdown>{"Read [Comment by Reviewer](#comment/task/source) and [Evidence](#artifact/evidence/revision).\n\nRead [Comment by Builder](#comment/other/source)."}</Markdown>
  </CommentReferenceProvider>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const comment = canvas.getByRole("button", { name: "Comment by Reviewer" });
    await expect(comment).toHaveAttribute("data-slot", "reference-chip");
    await expect(canvas.getByRole("link", { name: "Comment by Builder" })).toHaveAttribute("href", "#comment-source");
    await userEvent.click(comment);
    await expect(comment).toHaveFocus();
  },
};
export const Dark: Story = { ...References, globals: { theme: "dark" } };
export const LongReference: Story = {
  args: { children: "Comment by a reviewer with a long name that must wrap within a narrow message" },
  decorators: [(Story) => <div className="max-w-48"><Story /></div>],
};
