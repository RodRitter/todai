import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ThemeSwitcher } from "./theme-switcher";

const meta = {
  title: "Foundations/Theme switcher",
  component: ThemeSwitcher,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Appearance" }));
    const menu = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Appearance" });
    await expect(within(menu).getByRole("switch", { name: "Dark mode" })).toBeVisible();
  },
} satisfies Meta<typeof ThemeSwitcher>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = { globals: { theme: "light" } };
export const Dark: Story = { globals: { theme: "dark" } };
export const Interactive: Story = {
  parameters: { liveTheme: true },
  play: async (context) => {
    await meta.play(context);
    const body = within(context.canvasElement.ownerDocument.body);
    const toggle = body.getByRole("switch", { name: "Dark mode" });
    const checked = toggle.getAttribute("aria-checked") === "true";
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-checked", String(!checked));
    await expect(body.getByRole("dialog", { name: "Appearance" })).toBeVisible();
    await userEvent.click(toggle);
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog", { name: "Appearance" })).not.toBeInTheDocument();
    await expect(within(context.canvasElement).getByRole("button", { name: "Appearance" })).toHaveFocus();
  },
};
