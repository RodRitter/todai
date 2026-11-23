import { useState } from "react";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { modelUsage, usageTotals, type TaskUsageOverview as UsageData, type UsageCall } from "@/domain/usage";
import { TaskUsage } from "./task-usage";
const call: UsageCall = { id: "one", agentName: "Builder", model: "gpt-6.1-sol", effort: "medium", kind: "workflow", startedAt: "2026-11-23T10:00:00Z", finishedAt: "2026-11-23T10:01:00Z", outcome: "Complete", complete: true,
  tokens: { input_tokens: 100000, cached_input_tokens: 80000, output_tokens: 10000, reasoning_output_tokens: 5000 }, credits: 3.7,
  rate: { version: "2026-11-23", source: "https://help.openai.com/en/articles/11481834", input: 50, cached: 2.5, output: 250 } };
function data(calls: UsageCall[]): UsageData { return { trackingSince: call.startedAt, totals: usageTotals(calls), models: modelUsage(calls), groups: {
  workflow: usageTotals(calls.filter(c => c.kind === "workflow")), reply: usageTotals(calls.filter(c => c.kind === "reply")), chat: usageTotals(calls.filter(c => c.kind === "chat")), background: usageTotals(calls.filter(c => c.kind === "background")),
} }; }
const meta = { title: "Tasks/Usage", component: TaskUsage, args: { taskId: "task", active: true, load: async () => data([call]) }, parameters: { layout: "padded" } } satisfies Meta<typeof TaskUsage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByRole("button", { name: "Tokens" })).toBeVisible();
  await expect(canvas.getAllByText("Uncached input")[0]).toBeVisible();
  const credits = canvas.getByRole("button", { name: "Credits" });
  await userEvent.tab();
  await expect(credits).toHaveFocus();
  await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent("Published Standard rates");
  await userEvent.keyboard("{Escape}");
  await userEvent.tab();
  await expect(canvas.getByRole("button", { name: "Tokens" })).toHaveFocus();
  await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent("Tracking started");
  await userEvent.keyboard("{Escape}");
  await userEvent.hover(credits);
  await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent("Published Standard rates");
} };
export const Empty: Story = { args: { load: async () => data([]) } };
export const Historical: Story = { args: { load: async () => data([{ ...call, tokens: null, credits: null, rate: null, complete: false }]) } };
export const Pending: Story = { args: { load: async () => data([{ ...call, outcome: "Running", tokens: null, credits: null, complete: false, finishedAt: null }]) } };
export const Partial: Story = { args: { load: async () => data([call, { ...call, id: "two", kind: "chat", outcome: "Interrupted", complete: false, rate: null, credits: null }]) } };
export const Failed: Story = { args: { load: async () => data([{ ...call, outcome: "Failed" }]) } };
export const Loading: Story = { args: { load: () => new Promise(() => {}) } };
export const Unavailable: Story = { args: { load: async () => { throw new Error("Offline"); } } };
export const Retry: Story = { args: { load: (() => { let first = true; return async () => { if (first) { first = false; throw new Error("Offline"); } return data([call]); }; })() }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); await userEvent.click(await canvas.findByRole("button", { name: "Retry" })); await expect(await canvas.findByRole("button", { name: "Tokens" })).toBeVisible();
} };
export const Narrow: Story = { args: { load: async () => data([{ ...call, agentName: "Builder with a very long agent name for narrow task dialogs" }]) }, decorators: [(Story) => <div className="max-w-72"><Story /></div>] };
export const Dark: Story = { globals: { theme: "dark" } };

function BadgeExample(args: React.ComponentProps<typeof TaskUsage>) {
  const [credits, setCredits] = useState<string | null>(null);
  const [tab, setTab] = useState("detail");
  return <Tabs value={tab} onValueChange={setTab}>
    <TabsList><TabsTrigger value="detail">Detail</TabsTrigger><TabsTrigger value="usage" aria-label="Usage">Usage{credits !== null && <TabsCount count={credits} />}</TabsTrigger></TabsList>
    <TabsContent value="usage" forceMount><TaskUsage {...args} active={tab === "usage"} onCreditsChange={setCredits} /></TabsContent>
  </Tabs>;
}
export const TabBadge: Story = {
  render: args => <BadgeExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("tab", { name: "Usage" })).toHaveTextContent("3.7"));
    await userEvent.click(canvas.getByRole("tab", { name: "Usage" }));
    await expect(await canvas.findByRole("button", { name: "Credits" })).toBeVisible();
  },
};
export const ZeroCreditsBadge: Story = { ...TabBadge, args: { load: async () => data([]) }, play: async ({ canvasElement }) => {
  await waitFor(() => expect(within(canvasElement).getByRole("tab", { name: "Usage" })).toHaveTextContent("0"));
} };

export const Models: Story = {
  args: { load: async () => data([call, { ...call, id: "high", effort: "high" }, { ...call, id: "other", model: "gpt-6-luna", effort: "low" }, { ...call, id: "legacy", effort: null, tokens: null, credits: null, complete: false }]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "Model" }));
    const table = canvas.getByRole("table", { name: "Usage by model and effort" });
    await expect(table).toBeVisible();
    await expect(within(table).getByText("medium")).toBeVisible();
    await expect(within(table).getByText("high")).toBeVisible();
    await expect(within(table).getByText("gpt-6-luna")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Activity" }));
    await expect(canvas.getByRole("table", { name: "Usage by activity" })).toBeVisible();
  },
};
export const ModelsNarrow: Story = { ...Models, decorators: [(Story) => <div className="max-w-72"><Story /></div>] };
export const ModelsDark: Story = { ...Models, globals: { theme: "dark" } };
