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

export const ReferencePills: Story = {
  args: {
    children: "[@Reviewer](#agent/reviewer) [Comment by Reviewer](#comment/task/source) [Design evidence](#artifact/evidence/r1) [$Review](/workspace/skills/review/SKILL.md) [/src/app.tsx](/workspace/src/app.tsx)",
  },
  play: async ({ canvasElement }) => {
    const pills = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-slot="reference-chip"]'));
    await expect(pills).toHaveLength(5);
    const styles = pills.map((pill) => getComputedStyle(pill));
    await expect(new Set(styles.map((style) => style.backgroundColor)).size).toBe(5);
    await expect(new Set(styles.map((style) => style.color)).size).toBe(5);
    for (const style of styles) {
      await expect(style.fontWeight).toBe("400");
      await expect(style.borderRadius).toBe("9999px");
      for (const property of ["display", "padding", "lineHeight", "fontSize", "borderWidth"] as const) {
        await expect(style[property]).toBe(styles[0][property]);
      }
    }
  },
};
export const ReferencePillsDark: Story = {
  ...ReferencePills,
  decorators: [(Story) => <div className="dark bg-background text-foreground"><Story /></div>],
};
