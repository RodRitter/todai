import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { AgentProfile } from "@/domain/column-agent";
import type { WorkflowExecution } from "@/domain/workflow";
import { TaskWorkflow } from "./task-workflow";

const agent: AgentProfile = { id: "builder", name: "Builder", tool: "codex", model: "gpt-6", effort: "high", instructions: "Build carefully and verify changes.", permissions: "workspace-write" };
const workflow = { id: "build", name: "Implement a feature", agentId: "builder", instructions: "Implement the task, run the relevant checks, and summarize the result.\n\nAsk for feedback if the requirements are ambiguous." };
const execution: WorkflowExecution = {
  id: "execution", taskId: "task", stepId: "build:agent", workflow, profile: agent, createdAt: "2026-11-18T09:00:00Z", status: "Complete",
  runs: [{ id: "run", agentName: "Builder", status: "Complete", createdAt: "2026-11-18T09:00:00Z", startedAt: "2026-11-18T09:01:00Z", finishedAt: "2026-11-18T09:05:00Z", summary: "Implemented artifact previews.\n\n- Preserved exact revision references\n- Verified keyboard access and server tests", prompt: "You are Builder, working on this task in Todai.\n\nBuild carefully and verify changes.\n\nWorkflow step instructions:\nImplement the task, run the relevant checks, and summarize the result.\n\nTask: Preview artifact revisions\n\nShow the exact selected revision inside the task." }],
};
const api = { list: async () => [workflow], history: async () => [execution], save: fn(async (value: typeof workflow) => value) };
const meta = { title: "Tasks/Task workflow", component: TaskWorkflow, args: { taskId: "task", workflowId: "build", onChange: fn(), agents: [agent], disabled: false, api }, parameters: { layout: "padded" } } satisfies Meta<typeof TaskWorkflow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Completed: Story = {};
export const Empty: Story = { args: { workflowId: null, api: { ...api, list: async () => [], history: async () => [] } } };
export const NoAgents: Story = { ...Empty, args: { ...Empty.args, agents: [] } };
export const Waiting: Story = { args: { disabled: true, api: { ...api, history: async () => [{ ...execution, status: "Waiting", runs: [{ ...execution.runs[0], status: "Waiting", summary: "Should unsupported documents offer a download only? I recommend preserving the original file and displaying its metadata." }] }] } } };
export const Failed: Story = { args: { api: { ...api, history: async () => [{ ...execution, status: "Failed", runs: [{ ...execution.runs[0], status: "Failed", summary: "Agent execution failed. Saved workspace changes were preserved." }] }] } } };
export const Narrow: Story = { decorators: [(Story) => <div className="max-w-72"><Story /></div>] };
export const Unavailable: Story = { args: { api: { ...api, list: async () => { throw new Error("Could not load workflows for this workspace."); } } } };
