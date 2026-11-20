import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { ScrollArea } from "./scroll-area";

const meta = {
  title: "Layout/Scroll Area",
  component: ScrollArea,
  parameters: { layout: "centered" },
  args: { className: "max-h-48 w-72" },
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  args: { children: <ul>{Array.from({ length: 40 }, (_, i) => <li key={i}><button type="button">Item {i + 1}</button></li>)}</ul> },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    viewport.scrollTop = viewport.scrollHeight;
    await expect(viewport.scrollTop).toBeGreaterThan(0);
    within(canvasElement).getByRole("button", { name: "Item 40" }).focus();
    await expect(within(canvasElement).getByRole("button", { name: "Item 40" })).toHaveFocus();
  },
};
export const Horizontal: Story = {
  args: { orientation: "horizontal", variant: "table", children: <table><tbody><tr>{Array.from({ length: 12 }, (_, i) => <td key={i} className="min-w-32">Column {i + 1}</td>)}</tr></tbody></table> },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    viewport.scrollLeft = viewport.scrollWidth;
    await expect(viewport.scrollLeft).toBeGreaterThan(0);
  },
};
export const Code: Story = {
  args: { orientation: "both", variant: "code", children: <pre>{Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: ${"Long output. ".repeat(30)}`).join("\n")}</pre> },
};
export const ShortContent: Story = { args: { children: <p>A short message.</p> } };
export const FlexHeight: Story = {
  render: () => <div className="flex h-64 w-72 flex-col"><h2>Fixed header</h2><ScrollArea className="flex-1">{Vertical.args?.children}</ScrollArea><p>Fixed footer</p></div>,
  play: Vertical.play,
};

export const BottomFade: Story = {
  args: { ...Vertical.args, fade: "bottom" },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    await expect(viewport).toHaveClass("scroll-fade-b");
    await expect(getComputedStyle(viewport).maskImage).not.toBe("none");
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    viewport.scrollTop = viewport.scrollHeight;
    await waitFor(() => expect(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop).toBeLessThan(1));
    const input = within(canvasElement).getByRole("button", { name: "Item 40" });
    input.focus();
    await expect(input).toHaveFocus();
  },
};
export const BottomFadeShortContent: Story = { args: { ...ShortContent.args, fade: "bottom" } };
export const BottomFadeDark: Story = { ...BottomFade, globals: { theme: "dark" } };
