import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ServerNotifications } from "./server-notifications";

const meta = {
  title: "Layout/Server notifications",
  component: ServerNotifications,
  tags: ["autodocs"],
  args: { load: async () => ({ workspace: "/projects/app", servers: [
    { pid: 123, command: "node", directory: "/projects/app/web", addresses: ["127.0.0.1:3000", "[::1]:3001"] },
  ] }) },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Running servers" }));
    await expect(await within(canvasElement.ownerDocument.body).findByRole("dialog")).toBeVisible();
  },
} satisfies Meta<typeof ServerNotifications>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Running: Story = {};
export const Empty: Story = { args: { load: async () => ({ workspace: "/projects/app", servers: [] }) } };
export const Unavailable: Story = { args: { load: async () => { throw new Error("Unavailable"); } } };
export const Loading: Story = { args: { load: () => new Promise(() => {}) } };
