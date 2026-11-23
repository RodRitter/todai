import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { GeneralSettings } from "./general-settings";

const meta = {
  title: "Tasks/General settings",
  component: GeneralSettings,
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (String(input) === "/api/general-settings") return Response.json({ userName: options?.method === "PUT" ? (JSON.parse(String(options.body)).userName ?? "Roderick").trim() : "Roderick" });
      if (String(input) === "/api/credit-limit") return Response.json({ creditLimit: JSON.parse(String(options?.body)).creditLimit });
      if (String(input) === "/api/usage") return Response.json({ creditLimit: 100, credits: 25, trackedCredits: options?.method === "PUT" ? JSON.parse(String(options.body)).credits : 25 });
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

export const SetCredits: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const field = await canvas.findByLabelText("Current tracked credits");
  await expect(field).toHaveValue(25);
  await userEvent.clear(field);
  await userEvent.type(field, "50");
  await userEvent.click(canvas.getByRole("button", { name: "Set tracked credits" }));
  await expect(field).toHaveValue(50);
  await userEvent.click(canvas.getByRole("button", { name: "Reset tracking" }));
  await userEvent.click(await within(document.body).findByRole("button", { name: "Reset to zero" }));
  await expect(field).toHaveValue(0);
} };

export const Narrow: Story = {
  decorators: [(Story) => <div className="w-80"><Story /></div>],
};
export const NarrowDark: Story = { ...Narrow, globals: { theme: "dark" } };

export const SyncTaskCredits: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const field = await canvas.findByLabelText("Current tracked credits");
  await expect(field).toHaveValue(25);
  await userEvent.click(canvas.getByRole("button", { name: "Reset tracking" }));
  await userEvent.click(await within(document.body).findByRole("button", { name: "Reset to zero" }));
  await expect(field).toHaveValue(0);
  await userEvent.click(canvas.getByRole("button", { name: "Use task total: 25 credits" }));
  await expect(field).toHaveValue(25);
  await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
} };

export const UnchangedValues: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const limit = await canvas.findByLabelText("Maximum credits");
  await expect(limit).toHaveValue(100);
  await expect(canvas.getByRole("button", { name: "Save credit limit" })).toBeDisabled();
  await expect(canvas.getByRole("button", { name: "Set tracked credits" })).toBeDisabled();
  await userEvent.clear(limit);
  await userEvent.type(limit, "200");
  await expect(canvas.getByRole("button", { name: "Save credit limit" })).toBeEnabled();
  await userEvent.click(canvas.getByRole("button", { name: "Save credit limit" }));
  await expect(canvas.getByRole("button", { name: "Save credit limit" })).toBeDisabled();
} };
