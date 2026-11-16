import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ColumnAgentEditor } from './column-agent-editor';

const meta = {
  title: 'Tasks/Column agent editor',
  component: ColumnAgentEditor,
  tags: ['autodocs'],
  args: { column: 'In review', onClose: fn(), onSave: fn(async () => {}) },
} satisfies Meta<typeof ColumnAgentEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unconfigured: Story = {};
export const Configured: Story = {
  args: {
    agent: { column: 'In review', name: 'Reviewer', tool: 'codex', model: 'review-model',
      effort: 'high', instructions: 'Review the changes and leave a handover with your findings.', permissions: 'read-only' },
  },
};
