import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Confirmation } from "./confirmation";

const meta = {
  title: "Feedback/Confirmation",
  component: Confirmation,
  args: {
    state: "pending",
    question: "Should archived tasks stay visible?",
    recommendation: "Hide them by default and offer a filter.",
  },
} satisfies Meta<typeof Confirmation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};
export const Answered: Story = { args: { state: "answered" } };
export const Cancelled: Story = { args: { state: "cancelled" } };
export const Dark: Story = {
  decorators: [(Story) => <div className="dark bg-background p-4 text-foreground"><Story /></div>],
};
export const Narrow: Story = {
  decorators: [(Story) => <div className="max-w-80"><Story /></div>],
};
