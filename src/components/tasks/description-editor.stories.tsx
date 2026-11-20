import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
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
    id: "example-comment", label: "Your comment", agents: [], artifacts: true,
    actions: <Button size="sm" disabled>Post comment</Button>,
  },
};
export const DescriptionPreview: Story = {
  render: function Preview() {
    const [value, setValue] = useState("Click anywhere in this gray surface to edit the description.");
    return <DescriptionField value={value} disabled={false} onChange={setValue} />;
  },
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

export const PinnedCitation: Story = { args: { artifacts: true, value: "See [Design evidence](#artifact/evidence/r1) alongside [@Reviewer](#agent/reviewer)." } };

const artifact = { id: "quick", revisionId: "r1", revisionNumber: 1, title: "Notes", type: "markdown", creator: "You" };
const artifactSaved = fn();
const artifactRequest = fn();
export const QuickArtifact: Story = {
  args: { artifacts: true, onArtifactSelect: artifactSaved },
  beforeEach: () => {
    const original = globalThis.fetch;
    artifactSaved.mockClear();
    artifactRequest.mockClear();
    globalThis.fetch = async (input, options) => {
      if (String(input).startsWith("/api/artifacts")) {
        artifactRequest(options?.method ?? "GET");
        return Response.json(options?.method === "POST" ? artifact : []);
      }
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(editor);
    await userEvent.keyboard("#Notes");
    await canvas.findByRole("option", { name: "Create artifact “Notes”" });
    await userEvent.keyboard("{Enter}");
    const dialog = await page.findByRole("dialog");
    await expect(within(dialog).getByLabelText("Title")).toHaveValue("Notes");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await expect(editor).toHaveTextContent("#Notes");
    await expect(artifactRequest).not.toHaveBeenCalledWith("POST");
    await expect(artifactSaved).not.toHaveBeenCalled();
    await userEvent.click(editor);
    await userEvent.keyboard("{End}x{Backspace}");
    await canvas.findByRole("option", { name: "Create artifact “Notes”" });
    await userEvent.keyboard("{Enter}");
    const reopened = await page.findByRole("dialog");
    await userEvent.click(within(reopened).getByRole("textbox", { name: "Document content" }));
    await userEvent.keyboard("A new document");
    await userEvent.click(within(reopened).getByRole("button", { name: "Save and attach" }));
    await waitFor(() => expect(artifactSaved).toHaveBeenCalledWith(artifact));
    await expect(await canvas.findByRole("link", { name: "Notes" })).toHaveAttribute("href", "#artifact/quick/r1");
  },
};

export const ExistingArtifact: Story = {
  args: { artifacts: true, onArtifactSelect: artifactSaved },
  beforeEach: () => {
    const original = globalThis.fetch;
    artifactSaved.mockClear();
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/artifacts")
      ? Response.json([artifact]) : original(input, options);
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("textbox", { name: "Description" }));
    await userEvent.keyboard("#Notes");
    await canvas.findByRole("option", { name: /Notes Revision/ });
    await userEvent.keyboard("{Enter}");
    await expect(artifactSaved).toHaveBeenCalledWith(artifact);
    await expect(canvas.getByRole("link", { name: "Notes" })).toHaveAttribute("href", "#artifact/quick/r1");
    await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const ArtifactSaveFailure: Story = {
  args: { artifacts: true, onArtifactSelect: artifactSaved },
  beforeEach: () => {
    const original = globalThis.fetch;
    artifactSaved.mockClear();
    globalThis.fetch = async (input, options) => String(input).startsWith("/api/artifacts")
      ? options?.method === "POST" ? Response.json({ error: "Could not save artifact. Try again." }, { status: 500 }) : Response.json([])
      : original(input, options);
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("textbox", { name: "Description" }));
    await userEvent.keyboard("#Notes");
    await canvas.findByRole("option", { name: "Create artifact “Notes”" });
    await userEvent.keyboard("{Enter}");
    const dialog = within(await page.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("textbox", { name: "Document content" }));
    await userEvent.keyboard("Keep this draft");
    await userEvent.click(dialog.getByRole("button", { name: "Save and attach" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent("Could not save artifact");
    await expect(dialog.getByRole("textbox", { name: "Document content" })).toHaveTextContent("Keep this draft");
    await expect(artifactSaved).not.toHaveBeenCalled();
  },
};
