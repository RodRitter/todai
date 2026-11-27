import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EditableSetting } from "./editable-setting";

const meta = {
  title: "UI/Editable setting",
  component: EditableSetting,
  args: { id: "setting", label: "Name", value: "Original", onSave: fn(async () => {}) },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <EditableSetting {...args} value={value} onSave={async next => { await args.onSave(next); setValue(next); }} />;
  },
} satisfies Meta<typeof EditableSetting>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Display: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const SaveOnEnter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit name: Original" }));
    const field = canvas.getByRole("textbox", { name: "Name" });
    await userEvent.clear(field); await userEvent.type(field, "Changed{Enter}");
    await expect(await canvas.findByRole("button", { name: "Edit name: Changed" })).toBeVisible();
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenCalledWith("Changed");
  },
};
export const SaveOnBlur: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit name: Original" }));
    await userEvent.clear(canvas.getByRole("textbox"));
    await userEvent.type(canvas.getByRole("textbox"), "Changed");
    await userEvent.tab();
    await expect(await canvas.findByRole("button", { name: "Edit name: Changed" })).toBeVisible();
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenCalledWith("Changed");
  },
};
export const Cancel: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit name: Original" }));
    await userEvent.type(canvas.getByRole("textbox"), " draft{Escape}");
    await expect(canvas.getByRole("button", { name: "Edit name: Original" })).toBeVisible();
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};
export const InvalidNumber: Story = {
  args: { label: "Credits", value: "10", type: "number", min: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit credits: 10" }));
    const field = canvas.getByRole("spinbutton");
    await userEvent.clear(field); await userEvent.type(field, "-1{Enter}");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};
export const Failure: Story = {
  args: { onSave: fn(async () => { throw new Error("Save failed. Try again."); }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit name: Original" }));
    const field = canvas.getByRole("textbox");
    await userEvent.clear(field); await userEvent.type(field, "Draft{Enter}");
    await expect(field).toHaveValue("Draft"); await expect(field).toBeEnabled();
  },
};
export const Pending: Story = { args: { onSave: fn(() => new Promise<void>(() => {})) }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Edit name: Original" }));
  await userEvent.type(canvas.getByRole("textbox"), " change{Enter}");
  await expect(canvas.getByRole("textbox")).toBeDisabled();
} };
