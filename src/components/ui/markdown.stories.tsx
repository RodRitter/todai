import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Markdown } from "./markdown";
import { ScrollArea } from "./scroll-area";

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
export const NestedTable: Story = {
  args: { children: "| Check | Result |\n| --- | --- |\n| Tests | Passed |" },
  render: (args) => (
    <ScrollArea className="h-80 w-80">
      <Markdown {...args} />
      {Array.from({ length: 30 }, (_, index) => <p key={index}>Activity entry {index + 1}</p>)}
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const [panel, content] = canvasElement.querySelectorAll<HTMLElement>('[data-slot="scroll-area-viewport"]');
    await expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    await expect(getComputedStyle(panel).overscrollBehaviorY).toBe("contain");
    await expect(getComputedStyle(content).overscrollBehaviorY).toBe("auto");
  },
};
export const NestedShortCode: Story = {
  ...NestedTable,
  args: { children: "```ts\nconst status = 'Complete';\n```" },
};
export const NestedLongCode: Story = {
  ...NestedTable,
  args: { children: `\`\`\`text\n${Array.from({ length: 50 }, (_, index) => `Line ${index + 1}: ${"Long output. ".repeat(15)}`).join("\n")}\n\`\`\`` },
};
export const NestedWideTable: Story = {
  ...NestedTable,
  args: { children: `| Check | Result |\n| --- | --- |\n| ${"Wide_column_".repeat(20)} | Passed |` },
};
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
    children: "Review [TASK-42](#task/42) with [@Reviewer](#agent/reviewer) [Comment by Reviewer](#comment/task/source) [Design evidence](#artifact/evidence/r1) [$Review](/workspace/skills/review/SKILL.md) [/src/app.tsx](/workspace/src/app.tsx)",
  },
  play: async ({ canvasElement }) => {
    const pills = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-slot="reference-chip"]'));
    await expect(pills).toHaveLength(6);
    const styles = pills.map((pill) => getComputedStyle(pill));
    await expect(new Set(styles.map((style) => style.backgroundColor)).size).toBe(1);
    await expect(new Set(styles.map((style) => style.color)).size).toBe(5);
    for (const pill of pills) {
      const style = getComputedStyle(pill);
      await expect(style.fontSize).toBe(getComputedStyle(pill.parentElement!).fontSize);
      await expect(getComputedStyle(pill, "::before").content).toBe(pill.dataset.referenceKind === "artifact" ? '"#"' : "none");
      await expect(style.fontWeight).toBe("400");
      await expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      await expect(style.padding).toBe("0px");
      await expect(style.borderWidth).toBe("0px");
      await expect(style.borderRadius).toBe("0px");
      for (const property of ["display", "padding", "lineHeight", "fontSize", "borderWidth"] as const) {
        await expect(style[property]).toBe(styles[0][property]);
      }
    }
  },
};
export const ReferencePillsDark: Story = {
  ...ReferencePills,
  globals: { theme: "dark" },
};

export const ReferencePillsNarrow: Story = {
  ...ReferencePills,
  decorators: [(Story) => <div className="max-w-64"><Story /></div>],
};
