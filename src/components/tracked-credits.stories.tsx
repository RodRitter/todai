import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within, userEvent } from "storybook/test";
import { TrackedCredits } from "./tracked-credits";
const breakdown = { uncachedInput: { tokens: 20000, credits: 1 }, cachedInput: { tokens: 80000, credits: .2 }, output: { tokens: 10000, credits: 2.5 } };
const emptyBreakdown = { uncachedInput: { tokens: 0, credits: 0 }, cachedInput: { tokens: 0, credits: 0 }, output: { tokens: 0, credits: 0 } };
const meta = { title: "Layout/Tracked credits", component: TrackedCredits, parameters: { layout: "centered" }, args: { load: async () => ({ credits: 3.7, calls: 12, priced: 12, measured: 12, breakdown }) } } satisfies Meta<typeof TrackedCredits>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { play: async ({ canvasElement }) => {
  await expect(await within(canvasElement).findByRole("button", { name: "3.7 tracked credits" })).toBeVisible();
} };
export const Empty: Story = { args: { load: async () => ({ credits: 0, calls: 0, priced: 0, measured: 0, breakdown: emptyBreakdown }) } };
export const Partial: Story = { args: { load: async () => ({ credits: 3.7, calls: 12, priced: 5, measured: 8, breakdown }) } };
export const Unavailable: Story = { args: { load: async () => { throw new Error("Offline"); } } };
export const Dark: Story = { globals: { theme: "dark" } };

export const Open: Story = { name: "Open compact table", play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = await canvas.findByRole("button", { name: "3.7 tracked credits" });
  await userEvent.click(trigger);
  const dialog = await within(document.body).findByRole("dialog", { name: "Workspace usage" });
  await expect(within(dialog).getByRole("heading", { name: "Workspace usage" })).toBeVisible();
  await expect(within(dialog).queryByRole("button", { name: /About/ })).not.toBeInTheDocument();
  await expect(within(dialog).getByText("110,000")).toBeVisible();
  await expect(within(dialog).getByText("Cached input")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect(trigger).toHaveFocus();
} };
export const OpenDark: Story = { ...Open, globals: { theme: "dark" } };

export const AtThreshold: Story = { args: { load: async () => ({ credits: 80, creditLimit: 100, calls: 12, priced: 12, measured: 12, breakdown }) }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByText("80%")).toHaveClass("bg-muted");
} };
export const AboveThreshold: Story = { args: { load: async () => ({ credits: 81, creditLimit: 100, calls: 12, priced: 12, measured: 12, breakdown }) }, play: async ({ canvasElement }) => {
  await expect(await within(canvasElement).findByText("81%")).toHaveClass("bg-destructive");
} };
export const AboveThresholdDark: Story = { ...AboveThreshold, globals: { theme: "dark" } };
export const OverLimit: Story = { args: { load: async () => ({ credits: 120, creditLimit: 100, calls: 12, priced: 12, measured: 12, breakdown }) } };
export const Reset: Story = { args: { reset: async () => ({ credits: 3.7, trackedCredits: 0, creditLimit: 100, calls: 12, priced: 12, measured: 12, breakdown }) }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "3.7 tracked credits" }));
  await userEvent.click(await within(document.body).findByRole("button", { name: "Reset tracking" }));
  await expect(await canvas.findByRole("button", { name: "0 / 100 tracked credits, 0% used" })).toBeVisible();
} };
