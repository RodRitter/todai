"use client";

import { useRef, useState, type FormEvent } from "react";
import { Bot, MessageSquare } from "lucide-react";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Markdown } from "@/components/ui/markdown";
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
  const pendingRun = editing?.agentStatus === "Queued" || editing?.agentStatus === "Running";
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
    const status = statuses.find((value) => value === data.get("status")) ?? editing?.status ?? defaultStatus;
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-3xl sm:p-8">
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
            <DescriptionField initialValue={editing?.description ?? ""} disabled={busy} onSave={editing ? async description => {
              setBusy(true);
              try {
                await notifyOperation(() => onSave({ ...editing, description }), {
                  loading: 'Saving description…',
                  success: 'Description saved.',
                  error: 'Could not save the description. Your draft is still open; try again.',
                });
              } finally { setBusy(false); }
            } : undefined} />
          </div>
          <div role="group" aria-label="Task properties" className="bg-muted/50 mt-6 flex flex-col gap-1 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
              <Label htmlFor="task-status" className="text-muted-foreground gap-2 leading-snug font-normal">
                Status
              </Label>
              <NativeSelect id="task-status" name="status" disabled={pendingRun} defaultValue={editing?.status ?? defaultStatus} className="bg-background dark:bg-background h-10 w-32 rounded-lg border-transparent shadow-none hover:bg-accent sm:w-40">
                {statuses.map((option) => <option key={option}>{option}</option>)}
              </NativeSelect>
            </div>
            {pendingRun && <p className="px-1 text-xs text-muted-foreground">Wait for the agent run to finish before moving or deleting this task.</p>}
          </div>
          {editing && <section aria-label="Comments" className="mt-8 space-y-5 border-t pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-muted-foreground size-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Comments</h3>
              <span className="text-muted-foreground text-xs tabular-nums">{editing.comments?.length ?? 0}</span>
            </div>
            {editing.comments?.length ? <ol className="space-y-6">{editing.comments.map(comment => (
              <li key={comment.id} className="flex gap-3">
                <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold" aria-hidden="true">
                  {comment.authorName ? comment.authorName.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() : <Bot className="size-4" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold wrap-anywhere">{comment.authorName || 'Agent'}</span>
                    <time className="text-muted-foreground text-xs" dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>
                      {new Date(comment.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </time>
                  </div>
                  <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <Markdown>{comment.body}</Markdown>
                  </div>
                </div>
              </li>
            ))}</ol> : <div className="rounded-xl border border-dashed px-4 py-8 text-center">
              <p className="text-muted-foreground text-sm">No comments yet.</p>
              <p className="text-muted-foreground mt-1 text-xs">Agent updates and handovers will appear here.</p>
            </div>}
          </section>}
          <DialogFooter className="flex-row flex-wrap items-center justify-end gap-2 pt-6">
            {editing && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Delete task"
                disabled={pendingRun}
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

function DescriptionField({ initialValue, disabled, onSave }: {
  initialValue: string;
  disabled: boolean;
  onSave?: (description: string) => Promise<void>;
}) {
  const [description, setDescription] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  async function saveDescription() {
    const value = draft.trim();
    try {
      await onSave?.(value);
      setDescription(value);
      setIsEditing(false);
    } catch { /* Keep the draft open; the persistence boundary reports the failure. */ }
  }

  function startEditing() {
    if (disabled) return;
    setDraft(description);
    setIsEditing(true);
  }

  return <>
    <Label htmlFor="task-description">Description</Label>
    <input type="hidden" name="description" value={isEditing ? draft : description} />
    {isEditing ? <div className="space-y-2">
      <Textarea id="task-description" value={draft} onChange={event => setDraft(event.target.value)} autoFocus className="min-h-32 font-mono text-sm" aria-describedby="description-hint" />
      <div className="flex items-center justify-between gap-3">
        <p id="description-hint" className="text-muted-foreground text-xs">Markdown supported.</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" aria-label="Cancel description edit" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button type="button" size="sm" aria-label="Save description" onClick={() => { void saveDescription(); }}>Save</Button>
        </div>
      </div>
    </div> : <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Edit description"
      aria-disabled={disabled}
      className="min-h-24 cursor-text rounded-lg border p-3 outline-none transition-colors hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={event => { if (!(event.target as HTMLElement).closest('a')) startEditing(); }}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          startEditing();
        }
      }}
    >
      {description.trim() ? <Markdown>{description}</Markdown> : <p className="text-muted-foreground text-sm">Click to add a description…</p>}
    </div>}
  </>;
}
