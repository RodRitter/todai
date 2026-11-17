import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AppShell } from "./app-shell";
import { Button } from "./ui/button";

const meta = {
  title: "Layout/App shell",
  component: AppShell,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    children: (
      <main id="task-board" className="p-8" tabIndex={-1}>
        Board content
      </main>
    ),
  },
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const HeaderAction: Story = {
  args: { headerActions: <Button size="sm">New task</Button> },
};
export const CollapsibleSidebar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse sidebar" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand sidebar" }),
    );
    await expect(
      canvas.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  },
};

export const Artifacts: Story = {
  args: { screen: "artifacts", children: <main className="p-8">Workspace artifacts</main> },
};
