import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { GeneralSettings } from "./general-settings";

const meta = {
  title: "Tasks/General settings",
  component: GeneralSettings,
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (String(input) === "/api/general-settings") return Response.json({ userName: options?.method === "PUT" ? JSON.parse(String(options.body)).userName.trim() : "Roderick" });
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof GeneralSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SavedName: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const SaveName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByLabelText("Your name");
    await expect(field).toHaveValue("Roderick");
    await userEvent.clear(field);
    await userEvent.type(field, "Alex");
    await userEvent.click(canvas.getByRole("button", { name: "Save name" }));
    await expect(canvas.getByRole("button", { name: "Save name" })).toBeDisabled();
    await expect(canvas.queryByText("Name saved.")).not.toBeInTheDocument();
  },
};
export const SaveError: Story = {
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => String(input) === "/api/general-settings" && options?.method === "PUT"
      ? Response.json({ error: "Could not save your name." }, { status: 500 }) : original(input, options);
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText("Your name");
    await expect(field).toHaveValue("Roderick");
    await userEvent.clear(field);
    await userEvent.type(field, "Alex");
    await userEvent.click(canvas.getByRole("button", { name: "Save name" }));
    await expect(field).toHaveValue("Alex");
    await expect(canvas.getByRole("button", { name: "Save name" })).toBeEnabled();
  },
};
