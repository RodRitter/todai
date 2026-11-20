import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ArtifactCreateDialog } from "./artifact-create-dialog";

const meta = {
  title: "Artifacts/Create dialog",
  component: ArtifactCreateDialog,
  args: { title: "Wide document", onSave: fn(), onCancel: fn(), onRestoreFocus: fn() },
} satisfies Meta<typeof ArtifactCreateDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WideDocument: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog");
    const editor = await page.findByRole("textbox", { name: "Document content" });
    await userEvent.click(editor);
    const clipboard = new DataTransfer();
    clipboard.setData("text/html", `<pre><code>${"wide_content_".repeat(100)}</code></pre><table><tbody><tr>${"<td>Wide column content</td>".repeat(40)}</tr></tbody></table>`);
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
    await waitFor(() => {
      expect(editor.querySelector("pre")).not.toBeNull();
      expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);
      const code = editor.querySelector("pre")!;
      expect(code.scrollWidth).toBeGreaterThan(code.clientWidth);
      const table = editor.querySelector(".tableWrapper")!;
      expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
    });
    await expect(page.getByRole("button", { name: "Save and attach" })).toBeVisible();
  },
};
