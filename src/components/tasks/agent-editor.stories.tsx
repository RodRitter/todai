import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { AgentEditor } from './agent-editor';

const meta = {
  title: 'Agents/Agent editor',
  component: AgentEditor,
  tags: ['autodocs'],
  args: { onClose: fn(), onSave: fn(async () => {}) },
} satisfies Meta<typeof AgentEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unconfigured: Story = {};
export const Configured: Story = {
  args: {
    agent: { id: 'reviewer', name: 'Reviewer', tool: 'codex', model: 'review-model',
      effort: 'high', instructions: 'Review the changes and leave a handover with your findings.', permissions: 'read-only' },
  },
};
