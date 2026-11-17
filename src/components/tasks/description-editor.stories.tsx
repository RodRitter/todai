import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { DescriptionEditor } from "./description-editor";
import { DescriptionField } from "./description-field";

function EditorExample(args: ComponentProps<typeof DescriptionEditor>) {
  const [value, setValue] = useState(args.value);
  return <DescriptionEditor {...args} value={value} onChange={(next) => {
    setValue(next);
    args.onChange(next);
  }} />;
}

const meta = {
  title: "Forms/Rich text editor",
  component: DescriptionEditor,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="mx-auto max-w-2xl"><Story /></div>],
  args: { value: "", onChange: fn() },
  render: (args) => <EditorExample {...args} />,
} satisfies Meta<typeof DescriptionEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithContent: Story = {
  args: { value: "## Requirements\n\nKeep **descriptions** and comments consistent.\n\n- Shared typography\n- One editor surface" },
};
export const Disabled: Story = { args: { value: "An agent is currently working.", disabled: true } };
export const Comment: Story = {
  args: {
    id: "example-comment", label: "Your comment", agents: [],
    actions: <Button size="sm" disabled>Post comment</Button>,
  },
};
export const DescriptionPreview: Story = {
  render: () => <DescriptionField initialValue="Click anywhere in this gray surface to edit the description." disabled={false} onChange={fn()} onSave={fn()} />,
};
export const SurfaceFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    const surface = editor.closest('[data-slot="editor-surface"]');
    if (!surface) throw new Error("Missing shared editor surface");
    await userEvent.click(surface);
    await expect(editor).toHaveFocus();
    await userEvent.keyboard("A focused editor");
    await expect(editor).toHaveTextContent("A focused editor");
  },
};
