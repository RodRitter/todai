import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AgentLibrary } from './agent-library';

const reviewer = { id: 'reviewer', name: 'Reviewer', tool: 'codex', model: 'custom-model', effort: 'high', instructions: '', permissions: 'read-only' } as const;
const meta = {
  title: 'Agents/Agent library',
  component: AgentLibrary,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AgentLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Assigned: Story = {
  args: { initialAgents: [reviewer], initialAssignments: [{ column: 'In review', agentId: 'reviewer' }, { column: 'Done', agentId: 'reviewer' }] },
};
export const CreateEditDelete: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'New agent' }));
    let dialog = within(await body.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Agent name'), 'My reviewer');
    await expect(dialog.getByRole('combobox', { name: 'Execution tool' })).toHaveValue('codex');
    await expect(dialog.getByRole('combobox', { name: 'Model' })).toHaveAttribute('list', 'agent-model-options');
    await userEvent.type(dialog.getByLabelText('Model'), 'my-custom-model');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('region', { name: 'My reviewer' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit agent' }));
    dialog = within(await body.findByRole('dialog'));
    await expect(dialog.getByLabelText('Model')).toHaveValue('my-custom-model');
    await userEvent.clear(dialog.getByLabelText('Agent name'));
    await userEvent.type(dialog.getByLabelText('Agent name'), 'Updated reviewer');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('region', { name: 'Updated reviewer' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Delete agent' }));
    await waitFor(() => expect(canvas.getByText('No agents yet. Create an agent to get started.')).toBeVisible());
  },
};
export const InvalidModel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'New agent' }));
    const dialog = within(await body.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Agent name'), 'Reviewer');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await expect(dialog.getByLabelText('Model')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText('Enter a model supported by your Codex CLI account.')).toBeVisible();
  },
};
export const FailedSave: Story = {
  args: { persistence: { save: async () => { throw new Error('Storage unavailable'); }, delete: async () => {} } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'New agent' }));
    const dialog = within(await body.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Agent name'), 'Unsaved agent');
    await userEvent.type(dialog.getByLabelText('Model'), 'custom-model');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await body.findByText('Could not save agent. Check local database access and try again. Your draft is still open.');
    await expect(dialog.getByLabelText('Agent name')).toHaveValue('Unsaved agent');
    await expect(dialog.getByRole('button', { name: 'Save agent' })).toBeEnabled();
  },
};

export const CompactList: Story = {
  args: {
    initialAgents: [
      { ...reviewer, id: 'planner', name: 'Planner', model: 'gpt-6.1-sol', effort: 'medium' },
      reviewer,
      { ...reviewer, id: 'builder', name: 'Builder', model: 'gpt-6.1-terra', permissions: 'workspace-write' },
    ],
    initialAssignments: [{ column: 'To do', agentId: 'planner' }, { column: 'In review', agentId: 'reviewer' }, { column: 'In progress', agentId: 'builder' }],
  },
};
