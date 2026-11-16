import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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


export const ToolModels: Story = {
  args: { agent: Configured.args!.agent },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole('dialog'));
    const settings = within(dialog.getByRole('group', { name: 'Execution settings' }));
    await expect(settings.getByLabelText('Execution tool')).toHaveValue('codex');
    await expect(settings.getByLabelText('Model')).toHaveValue('review-model');
    await expect(settings.getByLabelText('Effort')).toHaveValue('high');
    await expect(canvasElement.ownerDocument.getElementById('agent-model-options')).toContainHTML('value="gpt-6.1-sol"');
    await userEvent.clear(dialog.getByLabelText('Model'));
    await userEvent.type(dialog.getByLabelText('Model'), 'custom-codex-model');
    await userEvent.selectOptions(dialog.getByLabelText('Execution tool'), 'codex');
    await expect(dialog.getByLabelText('Model')).toHaveValue('custom-codex-model');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ tool: 'codex', model: 'custom-codex-model' }));
  },
};
