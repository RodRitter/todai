import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { CreditSettings } from "./credit-settings";
import { GeneralSettings } from "./general-settings";

const meta = {
  title: "Tasks/General settings",
  component: GeneralSettings,
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      if (String(input) === "/api/general-settings") return Response.json({ userName: options?.method === "PUT" ? (JSON.parse(String(options.body)).userName ?? "Roderick").trim() : "Roderick" });
      if (String(input) === "/api/credit-limit") return Response.json({ creditLimit: JSON.parse(String(options?.body)).creditLimit });
      if (String(input) === "/api/usage") return Response.json({ creditLimit: 100, credits: 50, taskCredits: 25, trackedCredits: options?.method === "PUT" ? (JSON.parse(String(options.body)).action === "sync" ? 25 : JSON.parse(String(options.body)).credits) : 25 });
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
    await userEvent.click(await canvas.findByRole("button", { name: "Edit your name: Roderick" }));
    const field = canvas.getByRole("textbox", { name: "Your name" });
    await userEvent.clear(field); await userEvent.type(field, "Alex{Enter}");
    await expect(await canvas.findByRole("button", { name: "Edit your name: Alex" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
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
    await userEvent.click(await canvas.findByRole("button", { name: "Edit your name: Roderick" }));
    const field = canvas.getByRole("textbox", { name: "Your name" });
    await userEvent.clear(field); await userEvent.type(field, "Alex{Enter}");
    await expect(field).toHaveValue("Alex"); await expect(field).toBeEnabled();
  },
};
export const SetCredits: Story = { render: () => <CreditSettings />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "Edit current tracked credits: 25" }));
  const field = canvas.getByRole("spinbutton", { name: "Current tracked credits" });
  await userEvent.clear(field); await userEvent.type(field, "50{Enter}");
  await expect(await canvas.findByRole("button", { name: "Edit current tracked credits: 50" })).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "Reset tracking" }));
  await userEvent.click(await within(document.body).findByRole("button", { name: "Reset to zero" }));
  await expect(await canvas.findByRole("button", { name: "Edit current tracked credits: 0" })).toBeVisible();
} };
export const Narrow: Story = { decorators: [(Story) => <div className="w-80"><Story /></div>] };
export const NarrowDark: Story = { ...Narrow, globals: { theme: "dark" } };
export const SyncTaskCredits: Story = { render: () => <CreditSettings />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByRole("button", { name: "Edit current tracked credits: 25" })).toBeEnabled();
  await userEvent.click(canvas.getByRole("button", { name: "Reset tracking" }));
  await userEvent.click(await within(document.body).findByRole("button", { name: "Reset to zero" }));
  await expect(await canvas.findByRole("button", { name: "Edit current tracked credits: 0" })).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "Use task total: 25 credits" }));
  await expect(await canvas.findByRole("button", { name: "Edit current tracked credits: 25" })).toBeVisible();
} };
export const UnchangedValues: Story = { render: () => <CreditSettings />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "Edit maximum credits: 100" }));
  await userEvent.keyboard("{Enter}");
  await expect(await canvas.findByRole("button", { name: "Edit maximum credits: 100" })).toBeVisible();
  await expect(canvas.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
} };
