import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Progress } from "./progress";

const meta = {
  title: "Feedback/Progress",
  component: Progress,
  args: { value: 40, "aria-label": "Progress" },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { value: 0 } };
export const Complete: Story = { args: { value: 100 } };
