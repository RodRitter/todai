import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SettingField } from "./setting-field";
import { Input } from "./input";
import { NativeSelect } from "./native-select";

const meta = {
  title: "Forms/Setting field",
  component: SettingField,
  decorators: [(Story) => <div className="w-full max-w-2xl space-y-4 p-4"><Story /></div>],
  parameters: { layout: "fullscreen" },
  args: { label: "Your name", htmlFor: "name", children: <Input id="name" defaultValue="Alex" /> },
} satisfies Meta<typeof SettingField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dropdown: Story = { args: { label: "Default executor", htmlFor: "executor", children: <NativeSelect id="executor"><option>Codex</option><option>Claude Code</option></NativeSelect> } };
export const Narrow: Story = { decorators: [(Story) => <div className="w-72"><Story /></div>] };
export const LongLabel: Story = { args: { label: "Current tracked workspace credits" } };
export const Disabled: Story = { args: { children: <Input id="name" defaultValue="Alex" disabled /> } };
export const Dark: Story = { globals: { theme: "dark" } };
