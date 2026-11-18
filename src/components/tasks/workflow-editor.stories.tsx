import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { WorkflowEditor } from "./workflow-editor";
import type { AgentProfile } from "@/domain/column-agent";
import type { Workflow } from "@/domain/workflow";

const agent: AgentProfile = { id: "builder", name: "Builder", tool: "codex" as const, model: "gpt-6", effort: "high", instructions: "Build carefully", permissions: "workspace-write" };
const meta = {
  title: "Tasks/Workflow editor", component: WorkflowEditor,
  args: { initial: { id: "ordered", name: "Build and review", steps: [
    { id: "build", agentId: "builder", instructions: "Build the feature" },
    { id: "review", agentId: "builder", instructions: "Review the result" },
  ] }, agents: [agent], disabled: false, save: fn(async (workflow: Workflow) => workflow), onSaved: fn(), onCancel: fn() },
  parameters: { layout: "padded" },
} satisfies Meta<typeof WorkflowEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ordered: Story = {};
export const ComposeSteps: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Move step 2 up" }));
    await userEvent.click(canvas.getByRole("button", { name: "Add agent step" }));
    await userEvent.type(canvas.getAllByLabelText("Step instructions")[2], "Publish result");
    await userEvent.click(canvas.getByRole("button", { name: "Remove step 2" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save workflow" }));
    await expect(args.save).toHaveBeenCalledWith({ id: "ordered", name: "Build and review", steps: [
      { id: "review", agentId: "builder", instructions: "Review the result" },
      { id: expect.any(String), agentId: "builder", instructions: "Publish result" },
    ] });
  },
};
export const EmptySequence: Story = { args: { initial: { id: "empty", name: "Empty", steps: [] } } };
export const UnavailableAgent: Story = { args: { agents: [] } };
export const Narrow: Story = { decorators: [(Story) => <div className="max-w-72"><Story /></div>] };
