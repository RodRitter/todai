import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { FieldHelp } from "./field-help";

const meta = {
  title: "UI/Field help",
  component: FieldHelp,
  args: { id: "example-help", label: "Maximum credits", children: "Zero disables alerts. Usage above 80% of this workspace limit appears in red." },
} satisfies Meta<typeof FieldHelp>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Help for Maximum credits" });
    trigger.focus();
    await expect(await within(document.body).findByRole("tooltip")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(within(document.body).queryByRole("tooltip")).not.toBeInTheDocument();
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
