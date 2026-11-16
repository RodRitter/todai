import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { notifyOperation, toast } from "./toast";

const meta = {
  title: "Feedback/Toast",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  render: () => (
    <Button onClick={() => toast.success("Task saved.")}>
      Show notification
    </Button>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Show notification" }),
    );
    await waitFor(() => expect(body.getByText("Task saved.")).toBeVisible());
    await userEvent.click(
      body.getByRole("button", { name: "Dismiss notification" }),
    );
    await waitFor(() =>
      expect(body.queryByText("Task saved.")).not.toBeInTheDocument(),
    );
  },
};
export const Error: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast.error("Could not save changes. Try again.", {
          duration: Infinity,
        })
      }
    >
      Show error
    </Button>
  ),
};
export const Information: Story = {
  render: () => (
    <Button
      onClick={() => toast.info("Agent configuration applies to this column.")}
    >
      Show information
    </Button>
  ),
};
export const Warning: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast.warning("Moving this task will interrupt its current run.")
      }
    >
      Show warning
    </Button>
  ),
};
export const Loading: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() => toast.loading("Saving task…", { id: "loading-example" })}
      >
        Show loading
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.dismiss("loading-example")}
      >
        Stop loading
      </Button>
    </div>
  ),
};
export const AsyncSuccess: Story = {
  render: () => (
    <Button
      onClick={() =>
        void notifyOperation(
          () => new Promise((resolve) => setTimeout(resolve, 700)),
          {
            loading: "Saving task…",
            success: "Task saved.",
            error: "Could not save changes.",
          },
        )
      }
    >
      Save task
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Save task" }),
    );
    await body.findByText("Saving task…");
    await waitFor(() => expect(body.getByText("Task saved.")).toBeVisible());
    await expect(body.queryByText("Saving task…")).not.toBeInTheDocument();
  },
};
export const AsyncFailure: Story = {
  render: () => (
    <Button
      onClick={() =>
        void notifyOperation(
          () =>
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new globalThis.Error("Storage unavailable")),
                700,
              ),
            ),
          {
            loading: "Saving task…",
            success: "Task saved.",
            error: "Could not save changes. Your draft is still open.",
          },
        ).catch(() => {})
      }
    >
      Fail save
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Fail save" }),
    );
    await body.findByText("Saving task…");
    await waitFor(() =>
      expect(
        body.getByText("Could not save changes. Your draft is still open."),
      ).toBeVisible(),
    );
    await expect(body.queryByText("Saving task…")).not.toBeInTheDocument();
  },
};
