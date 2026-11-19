import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { AgentProfile } from "@/domain/column-agent";
import type { Workflow } from "@/domain/workflow";
import { starterWorkflow } from "@/domain/workflow-templates";
import { WorkflowLibrary } from "./workflow-library";

const agent: AgentProfile = { id: "builder", name: "Builder", tool: "codex", model: "gpt-6", effort: "high", instructions: "Implement and verify.", permissions: "workspace-write" };
const columns = ["To do", "In progress", "In review", "Done"];
const workflow = starterWorkflow("implement-review", "build", { implementer: agent.id, reviewer: agent.id }, columns);
const api = {
  list: async () => [workflow],
  getDefault: async () => ({ workflowId: workflow.id, available: true }),
  setDefault: fn(async (workflowId: string | null) => ({ workflowId, available: Boolean(workflowId) })),
  save: fn(async (value: Workflow) => value),
};
const meta = { title: "Workflows/Library", component: WorkflowLibrary, args: { agents: [agent], columns, api }, parameters: { layout: "fullscreen" } } satisfies Meta<typeof WorkflowLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Empty: Story = { args: { agents: [], api: { ...api, list: async () => [], getDefault: async () => ({ workflowId: null, available: false }) } } };
export const UnavailableDefault: Story = { args: { api: { ...api, getDefault: async () => ({ workflowId: "missing", available: false }) } } };
export const LoadFailure: Story = { args: { api: { ...api, list: async () => { throw new Error("Could not load workflows."); } } } };
