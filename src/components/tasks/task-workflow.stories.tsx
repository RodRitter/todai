import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { AgentProfile } from "@/domain/column-agent";
import type { Workflow, WorkflowExecution } from "@/domain/workflow";
import { TaskWorkflow } from "./task-workflow";

const agent: AgentProfile = { id: "builder", name: "Builder", tool: "codex", model: "gpt-6", effort: "high", instructions: "Build carefully and verify changes.", permissions: "workspace-write" };
const workflow = { id: "build", name: "Implement a feature", agentId: "builder", instructions: "Implement the task, run the relevant checks, and summarize the result.\n\nAsk for feedback if the requirements are ambiguous." };
const execution: WorkflowExecution = {
  id: "execution", taskId: "task", stepId: "build:agent", workflow, profile: agent, createdAt: "2026-11-18T09:00:00Z", status: "Complete",
  runs: [{ id: "run", agentName: "Builder", status: "Complete", createdAt: "2026-11-18T09:00:00Z", startedAt: "2026-11-18T09:01:00Z", finishedAt: "2026-11-18T09:05:00Z", summary: "Implemented artifact previews.\n\n- Preserved exact revision references\n- Verified keyboard access and server tests", prompt: "You are Builder, working on this task in Todai.\n\nBuild carefully and verify changes.\n\nWorkflow step instructions:\nImplement the task, run the relevant checks, and summarize the result.\n\nTask: Preview artifact revisions\n\nShow the exact selected revision inside the task." }],
};
const api = { list: async () => [workflow], history: async () => [execution], save: fn(async (value: Workflow) => value), retry: fn(async () => ({})) };
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

const ordered: Workflow = { id: "build", name: "Build and review", steps: [
  { id: "implement", agentId: agent.id, instructions: "Implement the requested change." },
  { id: "review", agentId: agent.id, instructions: "Review the changes and run checks." },
] };
function orderedExecution(status: WorkflowExecution["status"]): WorkflowExecution {
  return { ...execution, workflow: ordered, stepId: "review", status,
    steps: ordered.steps!.map((step, index) => ({ ...step, profile: agent, status: index === 0 ? "Complete" : status })),
    runs: [
      { ...execution.runs[0], stepId: "implement" },
      { ...execution.runs[0], id: "review-run", stepId: "review", status, summary: status === "Complete" ? "Review complete. All checks passed." : "Workspace changes preserved. Retry this step to continue." },
    ],
  };
}
function sequenceStory(status: WorkflowExecution["status"]): Story {
  return { args: { api: { ...api, list: async () => [ordered], history: async () => [orderedExecution(status)] } } };
}
export const MultiStepComplete = sequenceStory("Complete");
export const MultiStepFailed = sequenceStory("Failed");
export const InterruptedRecovery = sequenceStory("Interrupted");
export const Cancelled = sequenceStory("Stopped");
export const InProgress = sequenceStory("Running");

const approvalWorkflow: Workflow = { id: "build", name: "Build and approve", steps: [
  { id: "implement", agentId: agent.id, instructions: "Implement and verify." },
  { id: "approval", kind: "checkpoint", instructions: "Review results and pinned artifact revisions." },
] };
export const HumanCheckpoint: Story = { args: { api: { ...api, list: async () => [approvalWorkflow], history: async () => [{
  ...execution, workflow: approvalWorkflow, stepId: "approval", status: "Waiting",
  steps: [
    { ...approvalWorkflow.steps![0], profile: agent, status: "Complete" },
    { ...approvalWorkflow.steps![1], profile: null, status: "Waiting" },
  ], runs: [{ ...execution.runs[0], stepId: "implement" }],
}] } } };
