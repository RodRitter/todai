import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ColumnSettings } from './column-settings';
import { statuses } from './task';

const meta = {
  title: 'Settings/Board columns',
  component: ColumnSettings,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  render: function Render(args) {
    let columns = [...args.initialColumns];
    return <ColumnSettings {...args} create={async name => {
      if (columns.some(column => column.toLowerCase() === name.trim().toLowerCase())) {
        throw new Error('A column with that name already exists.');
      }
      columns = [...columns, name.trim()];
      return columns;
    }} rename={async (column, name) => {
      columns = columns.map(value => value === column ? name.trim() : value);
      return columns;
    }} remove={async column => {
      columns = columns.filter(value => value !== column);
      return columns;
    }} reorder={async next => { columns = next; return columns; }} />;
  },
  args: { initialColumns: [...statuses], create: async name => [...statuses, name], reorder: async columns => columns, rename: async () => [...statuses], remove: async () => [...statuses] },
} satisfies Meta<typeof ColumnSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CustomColumns: Story = {
  args: { initialColumns: ['Planning', 'To do', 'In progress', 'In review', 'Done', 'Follow up'] },
};
export const FailedSave: Story = {
  render: args => <ColumnSettings {...args} create={async () => { throw new Error('Could not save columns. Try again.'); }} reorder={async () => { throw new Error('Could not save columns. Try again.'); }} rename={async () => { throw new Error('Could not rename the column. Try again.'); }} remove={async () => { throw new Error('Move all tasks to another column before deleting this column.'); }} />,
};

export const WithTaskCounts: Story = {
  args: { initialTaskCounts: { 'To do': 12, 'In progress': 1, 'In review': 3, Done: 0 } },
};
export const LastColumn: Story = {
  args: { initialColumns: ['To do'] },
};
