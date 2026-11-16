"use client";

import { useRef, useState, type FormEvent } from "react";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { statuses, type Status, type Task } from "./task";

export type TaskEditorProps = {
  open: boolean;
  task?: Task | null;
  defaultStatus?: Status;
  onOpenChange: (open: boolean) => void;
  onSave: (task: Task) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

export function TaskEditor({ open, task: editing = null, defaultStatus = "To do", onOpenChange, onSave, onDelete }: TaskEditorProps) {
  const draftId = useRef<string | null>(null);
  const [titleError, setTitleError] = useState(false);

  const [busy, setBusy] = useState(false);

  async function persist(operation: () => void | Promise<void>, deleting = false) {
    setBusy(true);
    try {
      await notifyOperation(operation, {
        loading: deleting ? "Deleting task…" : "Saving task…",
        success: deleting ? "Task deleted." : editing ? "Task saved." : "Task created.",
        error: deleting ? "Could not confirm the task was deleted. Try again or reload to check."
          : "Could not confirm changes were saved. Try again to save your draft.",
      });
      draftId.current = null;
      onOpenChange(false);
    } catch { /* Keep the draft open; notifyOperation reports the failure. */ }
    finally { setBusy(false); }
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setTitleError(true);
      return;
    }
    const status = statuses.find((value) => value === data.get("status")) ?? defaultStatus;
    const agentStatus = editing?.agentStatus ?? "Not started";
    void persist(() => onSave({
      id: editing?.id ?? (draftId.current ??= crypto.randomUUID()),
      title,
      description: String(data.get("description") ?? "").trim(),
      status,
      agentStatus,
      comments: editing?.comments ?? [],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) { if (!nextOpen) draftId.current = null; setTitleError(false); onOpenChange(nextOpen); } }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the task details." : "Add a task to the board."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveTask} key={editing?.id ?? "new"} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              name="title"
              defaultValue={editing?.title ?? ""}
              required
              autoFocus
              aria-invalid={titleError}
              aria-describedby={titleError ? "title-error" : undefined}
              onChange={() => setTitleError(false)}
            />
            {titleError && <p id="title-error" className="text-destructive text-sm">Enter a task title.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea id="task-description" name="description" defaultValue={editing?.description ?? ""} />
          </div>
          <div role="group" aria-label="Task properties" className="bg-muted/50 mt-6 flex flex-col gap-1 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
              <Label htmlFor="task-status" className="text-muted-foreground gap-2 leading-snug font-normal">
                Status
              </Label>
              <NativeSelect id="task-status" name="status" defaultValue={editing?.status ?? defaultStatus} className="bg-background dark:bg-background h-10 w-32 rounded-lg border-transparent shadow-none hover:bg-accent sm:w-40">
                {statuses.map((option) => <option key={option}>{option}</option>)}
              </NativeSelect>
            </div>
          </div>
          {editing && <section aria-label="Comments" className="space-y-2">
            <h3 className="text-sm font-medium">Comments</h3>
            {editing.comments?.length ? <ol className="space-y-3">{editing.comments.map(comment => (
              <li key={comment.id} className="rounded-lg border p-3">
                <time className="text-muted-foreground text-xs" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
                <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              </li>
            ))}</ol> : <p className="text-muted-foreground text-sm">No comments yet.</p>}
          </section>}
          <DialogFooter className="flex-row flex-wrap items-center justify-end gap-2 pt-6">
            {editing && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Delete task"
                className="text-muted-foreground mr-auto px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  void persist(() => onDelete(editing.id), true);
                }}
              >
                Delete
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              <DialogClose asChild><Button type="button" variant="ghost" size="sm" className="text-muted-foreground px-2 text-xs">Cancel</Button></DialogClose>
              <Button type="submit" size="sm" className="px-3 text-xs" aria-label={editing ? "Save changes" : "Create task"}>{editing ? "Save" : "Create task"}</Button>
            </div>
          </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
