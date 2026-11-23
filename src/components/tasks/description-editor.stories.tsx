import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ArrowUp } from "lucide-react";
import { PromptSend } from "@/components/ui/prompt-send";
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

function placeCaret(editor: HTMLElement, atStart: boolean) {
  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(editor);
  range.collapse(atStart);
  const selection = editor.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.ownerDocument.dispatchEvent(new Event("selectionchange"));
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
export const DescriptionArtifactPreview: Story = {
  render: () => <DescriptionField value="See [Notes](#artifact/quick/r1) for context." disabled={false} onChange={fn()} />,
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url.startsWith("/api/artifacts/download")) return new Response("# Saved notes");
      if (url.startsWith("/api/artifacts?")) return Response.json({
        ...artifact, workspaceId: "workspace", archived: false, description: "",
        createdAt: "2026-11-17T10:00:00Z", updatedAt: "2026-11-17T10:00:00Z",
        filename: "notes.md", mediaType: "text/markdown", byteSize: 13, url: null,
      });
      return original(input, options);
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const citation = canvas.getByRole("button", { name: "Notes" });
    // Include clicks on the icon nested inside the citation control.
    await userEvent.click(citation.querySelector("svg")!);
    await expect(canvas.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    const dialog = await page.findByRole("dialog", { name: "Notes" });
    await userEvent.click(await within(dialog).findByText("Saved notes"));
    await expect(dialog).toBeVisible();
    await expect(canvas.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await expect(canvas.getByRole("button", { name: "Edit description" })).toBeVisible();
    citation.focus();
    await userEvent.keyboard("{Enter}");
    await expect(await page.findByRole("dialog", { name: "Notes" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByText(/for context/));
    await expect(await canvas.findByRole("textbox", { name: "Description" })).toBeVisible();
  },
};
export const SurfaceFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    const surface = editor.closest('[data-slot="editor-surface"]');
    if (!surface) throw new Error("Missing shared editor surface");
    await userEvent.click(surface);
    await waitFor(() => expect(editor).toHaveFocus());
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
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: "Create artifact “Notes”" });
    await userEvent.keyboard("{Enter}");
    const dialog = await page.findByRole("dialog");
    await expect(within(dialog).getByLabelText("Title")).toHaveValue("Notes");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await expect(editor).toHaveTextContent("#Notes");
    await expect(artifactRequest).not.toHaveBeenCalledWith("POST");
    await expect(artifactSaved).not.toHaveBeenCalled();
    await userEvent.click(editor);
    placeCaret(editor, false);
    await userEvent.keyboard("x{Backspace}");
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: "Create artifact “Notes”" });
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
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Notes Revision/ });
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
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: "Create artifact “Notes”" });
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

export const ReplacePastedLinkWithArtifact: Story = {
  args: { artifacts: true, onArtifactSelect: artifactSaved },
  beforeEach: ExistingArtifact.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(editor);
    const clipboard = new DataTransfer();
    clipboard.setData("text/html", '<p>See <a href="https://example.com/document">Document</a> for context.</p>');
    clipboard.setData("text/plain", "See Document for context.");
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
    const link = await canvas.findByRole("link", { name: "Document" });
    const selection = canvasElement.ownerDocument.getSelection();
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(link);
    selection?.removeAllRanges();
    selection?.addRange(range);
    canvasElement.ownerDocument.dispatchEvent(new Event("selectionchange"));
    await userEvent.keyboard("#Notes");
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Notes Revision/ });
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("link", { name: "Notes" })).toHaveAttribute("href", "#artifact/quick/r1");
    await expect(editor).toHaveTextContent("See Notes for context.");
    await expect(artifactSaved).toHaveBeenCalledWith(artifact);
  },
};


export const LongDescriptionSuggestions: Story = {
  args: {
    artifacts: true,
    value: Array.from({ length: 24 }, (_, index) => `Paragraph ${index + 1}: Background and requirements for this task.`).join("\n\n"),
  },
  beforeEach: ExistingArtifact.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(editor);
    placeCaret(editor, true);
    await userEvent.keyboard("#Notes");
    const option = await page.findByRole("option", { name: /Notes Revision/ });
    await waitFor(() => expect(editor).toHaveFocus());
    const list = page.getByRole("listbox", { name: "Workspace artifacts" });
    await waitFor(() => {
      const bounds = list.getBoundingClientRect();
      const editorBounds = editor.getBoundingClientRect();
      expect(bounds.top).toBeLessThan(editorBounds.bottom);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
    });
    await userEvent.keyboard("{ArrowDown}");
    await expect(page.getByRole("option", { name: "Create artifact “Notes”" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowUp}");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    await expect(page.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(editor).toHaveFocus());
  },
};

export const CompactPrompt: Story = {
  args: {
    variant: "compact", label: "Your reply", agents: [], artifacts: true,
    actions: <PromptSend size="icon-xs" aria-label="Send reply"><ArrowUp /></PromptSend>,
  },
};
export const NarrowCompactPrompt: Story = {
  ...CompactPrompt,
  decorators: [(Story) => <div className="max-w-80"><Story /></div>],
};
export const DarkCompactPrompt: Story = {
  ...CompactPrompt,
  decorators: [(Story) => <div className="dark bg-background text-foreground p-4"><Story /></div>],
};
export const CompactArtifactTagging: Story = {
  ...QuickArtifact,
  args: { ...QuickArtifact.args, variant: "compact" },
};

export const ReferenceBadges: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const references = Array.from(canvasElement.querySelectorAll<HTMLElement>(".tiptap a"));
      expect(references).toHaveLength(5);
      const styles = references.map((reference) => getComputedStyle(reference));
      expect(new Set(styles.map((style) => style.backgroundColor)).size).toBe(5);
      for (const style of styles) {
        expect(style.fontWeight).toBe("400");
        expect(style.borderRadius).toBe("9999px");
      }
    });
  },
  args: {
    artifacts: true,
    value: "[@Reviewer](#agent/reviewer) [Design evidence](#artifact/evidence/r1) [$Review](/workspace/skills/review/SKILL.md) [/src/app.tsx](/workspace/src/app.tsx) [Comment by Reviewer](#comment/task/comment)",
  },
};
export const ReferenceBadgesDark: Story = {
  ...ReferenceBadges,
  decorators: [(Story) => <div className="dark bg-background text-foreground p-4"><Story /></div>],
};
export const ReferenceBadgesNarrow: Story = {
  ...ReferenceBadges,
  decorators: [(Story) => <div className="max-w-64"><Story /></div>],
};

export const CompactReply: Story = {
  args: { variant: "reply", label: "Your reply", actions: <PromptSend aria-label="Send reply"><ArrowUp /></PromptSend>, toolbarActions: <Button size="xs">Attach artifact</Button> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your reply" });
    await expect(editor).toHaveAttribute("data-placeholder", "Reply");
    await expect(canvas.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Attach artifact" })).not.toBeInTheDocument();
    const surface = editor.closest('[data-slot="input-group"]')!;
    const height = surface.getBoundingClientRect().height;
    await userEvent.click(editor);
    await waitFor(() => expect(editor).toHaveFocus());
    await expect(getComputedStyle(surface).getPropertyValue("--tw-ring-inset").trim()).toBe("inset");
    await expect(await canvas.findByRole("button", { name: "Send reply" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Attach artifact" })).toBeVisible();
    await waitFor(() => expect(surface.getBoundingClientRect().height).toBeGreaterThan(height));
    await userEvent.type(editor, "Keep this reply.");
    await expect(editor).toHaveTextContent("Keep this reply.");
    await userEvent.click(canvas.getByRole("button", { name: "Attach artifact" }));
    await expect(await canvas.findByRole("button", { name: "Send reply" })).toBeVisible();
    await userEvent.click(canvasElement);
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument());
    await waitFor(() => expect(surface.getBoundingClientRect().height).toBe(height));
    await expect(editor).toHaveTextContent("Keep this reply.");
    await userEvent.click(editor);
    await expect(await canvas.findByRole("button", { name: "Send reply" })).toBeVisible();
    await expect(editor).toHaveTextContent("Keep this reply.");
  },
};
export const CompactReplyKeyboard: Story = {
  ...CompactReply,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your reply" });
    editor.focus();
    await waitFor(() => expect(canvas.getByRole("button", { name: "Send reply" })).toBeVisible());
    await waitFor(() => expect(editor).toHaveFocus());
  },
};
export const CompactReplyDisabled: Story = { args: { ...CompactReply.args, disabled: true } };
export const CompactReplyNarrow: Story = { ...CompactReply, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const CompactReplyDark: Story = { ...CompactReply, globals: { theme: "dark" } };

const unifiedAgents = [{ id: "reviewer", name: "Reviewer", tool: "codex" as const, model: "test", effort: "medium" as const, permissions: "workspace-write" as const, instructions: "Review code and proposed changes." }];
function mockTagSearch() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/artifacts") return Response.json([{ ...artifact, title: "Review notes" }].filter((item) => item.title.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase())));
    if (url.pathname === "/api/references") {
      const references = url.searchParams.get("kind") === "skill"
        ? [{ kind: "skill", label: "$code-review", path: "/workspace/skills/code-review/SKILL.md", detail: "Review code changes." }]
        : [{ kind: "file", label: "/review.ts", path: "/workspace/src/review.ts", detail: "src/review.ts" }];
      return Response.json({ references: references.filter((item) => item.label.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase())) });
    }
    return original(input, options);
  };
  return () => { globalThis.fetch = original; };
}
export const UnifiedTags: Story = {
  args: { agents: unifiedAgents, artifacts: true, variant: "prompt", onArtifactSelect: artifactSaved },
  beforeEach: mockTagSearch,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.type(editor, "@review");
    for (const name of [/@Reviewer/, /Review notes Revision/, /\$code-review/, /\/review.ts/]) await page.findByRole("option", { name });
    await waitFor(() => expect(editor).toHaveFocus());
    await userEvent.click(page.getByRole("button", { name: "Artifacts" }));
    await expect(page.getByRole("textbox", { name: "Search tags" })).toHaveValue("review");
    await page.findByRole("option", { name: /Review notes Revision/ });
    await expect(page.queryByRole("option", { name: /@Reviewer/ })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "All" }));
    await page.findByRole("option", { name: /\$code-review/ });
    await userEvent.click(page.getByRole("textbox", { name: "Search tags" }));
    await userEvent.clear(page.getByRole("textbox", { name: "Search tags" }));
    await userEvent.type(page.getByRole("textbox", { name: "Search tags" }), "code-review");
    await page.findByRole("option", { name: /\$code-review/ });
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("link", { name: "$code-review" })).toHaveAttribute("href", "/workspace/skills/code-review/SKILL.md");
    await waitFor(() => expect(editor).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "Add tag" }));
    await page.findByRole("option", { name: /Review notes Revision/ });
  },
};
export const UnifiedTagsDark: Story = { ...UnifiedTags, globals: { theme: "dark" } };
export const UnifiedTagSelection: Story = {
  ...UnifiedTags,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.type(editor, "See ");
    for (const [option, label, href] of [
      [/@Reviewer/, "@Reviewer", "#agent/reviewer"],
      [/Review notes Revision/, "Review notes", "#artifact/quick/r1"],
      [/\$code-review/, "$code-review", "/workspace/skills/code-review/SKILL.md"],
      [/\/review.ts/, "/review.ts", "/workspace/src/review.ts"],
    ] as const) {
      await userEvent.click(canvas.getByRole("button", { name: "Add tag" }));
      await userEvent.click(await page.findByRole("option", { name: option }));
      await expect(canvas.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    await expect(editor).toHaveTextContent("See @Reviewer Review notes $code-review /review.ts");
    await expect(artifactSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "quick", revisionId: "r1" }));
  },
};
export const UnifiedTagsEmpty: Story = {
  ...UnifiedTags,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.type(editor, "@missing");
    await page.findByText("No matching references. Try another name or type.");
    await userEvent.keyboard("{Enter}");
    await expect(editor).toHaveTextContent("@missing");
    await userEvent.keyboard("{Escape}");
    await expect(page.queryByRole("listbox")).not.toBeInTheDocument();
  },
};
export const UnifiedTagsFailure: Story = {
  ...UnifiedTags,
  beforeEach: () => {
    const cleanup = mockTagSearch();
    const success = globalThis.fetch;
    let fail = true;
    globalThis.fetch = async (input, options) => {
      if (String(input).startsWith("/api/artifacts") && fail) { fail = false; return Response.json({}, { status: 500 }); }
      return success(input, options);
    };
    return cleanup;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Add tag" }));
    await page.findByText("Could not load: Artifacts.");
    await expect(page.getByRole("option", { name: /@Reviewer/ })).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Retry" }));
    await page.findByRole("option", { name: /Review notes Revision/ });
    await expect(page.queryByText("Could not load: Artifacts.")).not.toBeInTheDocument();
  },
};
export const UnifiedTagShortcuts: Story = {
  ...UnifiedTags,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    for (const [prefix, filter, name] of [["$code", "Skills", /\$code-review/], ["/review", "Files", /\/review.ts/], ["#Review", "Artifacts", /Review notes Revision/]] as const) {
      await userEvent.type(editor, prefix);
      await expect(page.getByRole("button", { name: filter })).toHaveAttribute("aria-pressed", "true");
      await page.findByRole("option", { name });
      await userEvent.keyboard("{Tab}");
      await waitFor(() => expect(page.queryByRole("listbox")).not.toBeInTheDocument());
    }
    await expect(canvas.getByRole("link", { name: "$code-review" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "/review.ts" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Review notes" })).toBeVisible();
  },
};

export const CollapsibleMessage: Story = {
  ...CompactReply,
  args: { variant: "prompt", compact: true, label: "Your message", actions: <PromptSend aria-label="Send message"><ArrowUp /></PromptSend>, toolbarActions: <Button size="xs">Attach artifact</Button> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your message" });
    const surface = editor.closest('[data-slot="input-group"]')!;
    await expect(surface.getBoundingClientRect().height).toBe(40);
    await expect(canvas.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    editor.focus();
    await expect(await canvas.findByRole("button", { name: "Send message" })).toBeVisible();
    await waitFor(() => expect(surface.getBoundingClientRect().height).toBeGreaterThan(40));
    await userEvent.type(editor, "Keep this message.{Shift>}{Enter}{/Shift}Second line.");
    await userEvent.click(canvas.getByRole("button", { name: "Attach artifact" }));
    await expect(canvas.getByRole("button", { name: "Send message" })).toBeVisible();
    await userEvent.click(canvasElement);
    await waitFor(() => expect(surface.getBoundingClientRect().height).toBe(40));
    await expect(canvas.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    await userEvent.click(editor);
    await expect(await canvas.findByRole("button", { name: "Send message" })).toBeVisible();
    await expect(editor).toHaveTextContent("Keep this message.Second line.");
  },
};
export const CollapsibleMessageNarrow: Story = { ...CollapsibleMessage, decorators: [(Story) => <div className="max-w-80"><Story /></div>] };
export const CollapsibleMessageDark: Story = { ...CollapsibleMessage, decorators: [(Story) => <div className="dark bg-background text-foreground p-4"><Story /></div>] };


export const DisabledCompactReply: Story = {
  args: { ...CompactReply.args, disabled: true, autoFocus: true, value: "Keep this draft." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Your reply" });
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(editor).toHaveTextContent("Keep this draft.");
    await expect(editor.closest('[data-slot="input-group"]')!.getBoundingClientRect().height).toBe(40);
    await expect(canvas.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
  },
};
export const DisabledCompactMessage: Story = {
  ...DisabledCompactReply,
  args: { ...DisabledCompactReply.args, variant: "prompt" },
};
