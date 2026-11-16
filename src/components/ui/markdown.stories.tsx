import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Markdown } from "./markdown";

const meta = {
  title: "Content/Markdown",
  component: Markdown,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    children:
      '# Handover\n\n**Implemented** the task board with *persistent* storage.\n\n- Save tasks\n- Keep comments\n\n1. Open a task\n2. Review the changes\n\n> Ready for review.\n\nUse `npm test` to verify.\n\n```ts\nconst status = "Complete";\n```\n\n| Check | Result |\n| --- | --- |\n| Tests | Passed |\n\n- [x] Build complete\n- [ ] Review pending\n\n[Documentation](https://example.com) and ~~old notes~~.',
  },
} satisfies Meta<typeof Markdown>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Formatted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Handover" }),
    ).toBeVisible();
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Documentation" }),
    ).toHaveAttribute("href", "https://example.com");
    await expect(canvas.getByRole("img", { name: "Completed" })).toBeVisible();
  },
};
export const Compact: Story = { args: { compact: true } };
export const UntrustedContent: Story = {
  args: {
    children:
      '<script>alert("unsafe")</script>\n\n[Unsafe link](javascript:alert%281%29)\n\n**Safe content**',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Safe content")).toBeVisible();
    await expect(canvasElement.querySelector("script")).toBeNull();
    await expect(
      canvasElement.querySelector('a[href^="javascript:"]'),
    ).toBeNull();
  },
};
