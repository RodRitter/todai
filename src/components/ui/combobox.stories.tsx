import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FolderIcon } from 'lucide-react';
import { Combobox } from './combobox';
import { Label } from './label';

const meta = {
  title: 'Forms/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    id: 'combobox-example',
    value: '',
    onValueChange: () => {},
    options: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'],
    placeholder: 'Select or enter a model',
    'aria-label': 'Model',
  },
  render: function Example(args) {
    const [value, setValue] = useState(args.value);
    return <div className="w-80 space-y-2">
      <Label htmlFor={args.id}>{args['aria-label']}</Label>
      <Combobox {...args} value={value} onValueChange={setValue} />
    </div>;
  },
} satisfies Meta<typeof Combobox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { value: 'gpt-5' } };
export const CustomValue: Story = { args: { value: 'my-custom-model' } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { 'aria-invalid': true } };
export const Directories: Story = {
  args: {
    'aria-label': 'Directory',
    icon: FolderIcon,
    value: '~/Projects/',
    placeholder: '~/Projects/',
    filterOptions: false,
    closeOnSelect: false,
    options: ['~/Projects/todai/', '~/Projects/design system/', '~/Projects/a-long-directory-name/nested-workspace/'],
  },
};
