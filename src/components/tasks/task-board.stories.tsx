import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { TaskBoard } from "./task-board";
import { exampleTasks } from "./task.fixtures";

const meta = {
  title: "Tasks/Task board",
  component: TaskBoard,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { initialTasks: exampleTasks },
} satisfies Meta<typeof TaskBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { initialTasks: [] } };
export const AllColumns: Story = {
  args: { initialTasks: [...exampleTasks, { ...exampleTasks[3], id: "5", title: "Review the task board", status: "In review" }] },
};
export const CreateEditDelete: Story = {
  args: { initialTasks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "New task" }));
    let dialog = within(await body.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Title"), "A new task");
    await userEvent.click(dialog.getByRole("button", { name: "Create task" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: /^Edit A new task,/ }));
    dialog = within(await body.findByRole("dialog"));
    await userEvent.clear(dialog.getByLabelText("Title"));
    await userEvent.type(dialog.getByLabelText("Title"), "Updated task");
    await userEvent.selectOptions(dialog.getByLabelText("Status"), "In review");
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    const review = within(canvas.getByRole("region", { name: "In review" }));
    await userEvent.click(review.getByRole("button", { name: /^Edit Updated task,/ }));
    dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Delete task" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(canvas.queryByRole("button", { name: /^Edit Updated task,/ })).not.toBeInTheDocument();
  },
};
export const MoveCard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("button", { name: /^Edit Build the task board,/ });
    const target = canvas.getByRole("region", { name: "In review" });
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(card, { dataTransfer });
    await fireEvent.dragOver(target, { dataTransfer });
    await fireEvent.drop(target, { dataTransfer });
    await fireEvent.dragEnd(card, { dataTransfer });
    await expect(within(target).getByRole("button", { name: /^Edit Build the task board,/ })).toBeInTheDocument();
  },
};

export const MoveKeepsColumnsStill: Story = {
  args: { persistence: { save: async task => task, delete: async () => {} } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    let finishSave: (() => void) | undefined;
    args.persistence!.save = task => new Promise(resolve => { finishSave = () => resolve(task); });
    const headings = canvas.getAllByRole('heading', { level: 2 });
    const positions = headings.map(heading => heading.getBoundingClientRect().top);
    const card = canvas.getByRole('button', { name: /^Edit Build the task board,/ });
    const target = canvas.getByRole('region', { name: 'In review' });
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(card, { dataTransfer });
    await fireEvent.dragOver(target, { dataTransfer });
    await fireEvent.drop(target, { dataTransfer });
    await fireEvent.dragEnd(card, { dataTransfer });
    try {
      await within(canvasElement.ownerDocument.body).findByText('Moving task…');
      await expect(headings.map(heading => heading.getBoundingClientRect().top)).toEqual(positions);
    } finally {
      finishSave?.();
    }
    await waitFor(() => expect(within(target).getByRole('button', { name: /^Edit Build the task board,/ })).toBeInTheDocument());
    await expect(headings.map(heading => heading.getBoundingClientRect().top)).toEqual(positions);
  },
};

export const ConfigureColumnAgent: Story = {
  args: { initialTasks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Configure agent for In review' }));
    let dialog = within(await body.findByRole('dialog'));
    await userEvent.clear(dialog.getByLabelText('Agent name'));
    await userEvent.type(dialog.getByLabelText('Agent name'), 'Reviewer');
    await expect(dialog.getByRole('combobox', { name: 'Execution tool' })).toHaveValue('codex');
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Execution tool' }), 'codex');
    await expect(dialog.getByRole('combobox', { name: 'Model' })).toHaveAttribute('list', 'agent-model-options');
    await expect(canvasElement.ownerDocument.getElementById('agent-model-options')).toContainHTML('value="gpt-6.1-sol"');
    await userEvent.type(dialog.getByLabelText('Model'), 'review-model');
    await userEvent.selectOptions(dialog.getByLabelText('Effort'), 'high');
    await userEvent.type(dialog.getByLabelText('Instructions'), 'Check the changes.');
    await userEvent.selectOptions(dialog.getByLabelText('Permissions'), 'read-only');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(within(canvas.getByRole('region', { name: 'In review' })).getByText('Reviewer')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Configure agent for In review' }));
    dialog = within(await body.findByRole('dialog'));
    await expect(dialog.getByLabelText('Model')).toHaveValue('review-model');
    await expect(dialog.getByLabelText('Effort')).toHaveValue('high');
    await expect(dialog.getByLabelText('Instructions')).toHaveValue('Check the changes.');
    await expect(dialog.getByLabelText('Permissions')).toHaveValue('read-only');
  },
};

export const InvalidColumnAgent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Configure agent for To do' }));
    const dialog = within(await body.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await expect(dialog.getByLabelText('Model')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText('Enter a model supported by your Codex CLI account.')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await expect(within(canvas.getByRole('region', { name: 'To do' })).getByText('No agent configured')).toBeVisible();
  },
};

export const FailedColumnAgentSave: Story = {
  args: { saveAgent: async () => { throw new Error('Storage unavailable'); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Configure agent for Done' }));
    const dialog = within(await body.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Model'), 'report-model');
    await userEvent.click(dialog.getByRole('button', { name: 'Save agent' }));
    await body.findByText('Could not save column agent. Check local database access and try again. Your draft is still open.');
    await expect(dialog.getByLabelText('Model')).toHaveValue('report-model');
    await expect(dialog.getByRole('button', { name: 'Save agent' })).toBeEnabled();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await expect(within(canvas.getByRole('region', { name: 'Done' })).getByText('No agent configured')).toBeVisible();
  },
};
