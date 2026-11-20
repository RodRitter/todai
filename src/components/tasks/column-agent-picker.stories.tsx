import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ColumnAgentPicker } from "./column-agent-picker";

const meta = {
  title: "Tasks/Column agent picker",
  component: ColumnAgentPicker,
  tags: ["autodocs"],
  args: {
    column: "In review",
    agents: [],
    onSave: fn(async () => {}),
  },
} satisfies Meta<typeof ColumnAgentPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoAgents: Story = {};
export const Assigned: Story = {
  args: {
    agentId: "reviewer",
    agents: [
      {
        id: "reviewer",
        name: "Reviewer",
        tool: "codex",
        model: "custom-model",
        effort: "high",
        instructions: "",
        permissions: "read-only",
      },
    ],
  },
};
