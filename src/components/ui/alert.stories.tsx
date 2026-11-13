import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert } from "./alert";
import { AlertTitle, AlertDescription } from "./alert";
import { InfoIcon, CircleAlertIcon } from "lucide-react";
const meta = {
  title: "Feedback/Alert",
  component: Alert,
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Alert {...args}>
      <InfoIcon />
      <AlertTitle>Information</AlertTitle>
      <AlertDescription>Additional context for this action.</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <CircleAlertIcon />
      <AlertTitle>Unable to continue</AlertTitle>
      <AlertDescription>
        Check the provided value and try again.
      </AlertDescription>
    </Alert>
  ),
};
