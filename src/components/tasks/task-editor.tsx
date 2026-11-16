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
  columns?: readonly string[];
  open: boolean;
  task?: Task | null;
  defaultStatus?: Status;
  onOpenChange: (open: boolean) => void;
  onSave: (task: Task) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

export function TaskEditor(props: TaskEditorProps) {
  return <TaskEditorSession key={`${props.task?.id ?? 'new'}:${props.open}`} {...props} />;
}

function TaskEditorSession({ columns = statuses, open, task: editing = null, defaultStatus = "To do", onOpenChange, onSave, onDelete }: TaskEditorProps) {
  const pendingRun = editing?.agentStatus === "Queued" || editing?.agentStatus === "Running";
  const draftId = useRef<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const currentStatus = selectedStatus !== null && columns.includes(selectedStatus)
    ? selectedStatus : editing?.status ?? defaultStatus;

  const [busy, setBusy] = useState(false);
  const [autoWorkflow, setAutoWorkflow] = useState(editing?.autoWorkflow ?? false);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [savedDescription, setSavedDescription] = useState(editing?.description ?? '');
  const canSave = Boolean(title.trim()) && (!editing
    || title.trim() !== editing.title.trim()
    || description.trim() !== savedDescription.trim()
    || currentStatus !== editing.status
    || autoWorkflow !== (editing.autoWorkflow ?? false));

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
      setSelectedStatus(null);
      onOpenChange(false);
    } catch { /* Keep the draft open; notifyOperation reports the failure. */ }
    finally { setBusy(false); }
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canSave) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setTitleError(true);
      return;
    }
    const status = columns.find((value) => value === data.get("status")) ?? editing?.status ?? defaultStatus;
    const agentStatus = editing?.agentStatus ?? "Not started";
    void persist(() => onSave({
      id: editing?.id ?? (draftId.current ??= crypto.randomUUID()),
      title,
      description: String(data.get("description") ?? "").trim(),
      status,
      agentStatus,
      autoWorkflow,
      comments: editing?.comments ?? [],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) { if (!nextOpen) { draftId.current = null; setSelectedStatus(null); } setTitleError(false); onOpenChange(nextOpen); } }}>
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
              value={title}
              required
              autoFocus
              aria-invalid={titleError}
              aria-describedby={titleError ? "title-error" : undefined}
              onChange={event => { setTitle(event.target.value); setTitleError(false); }}
            />
            {titleError && <p id="title-error" className="text-destructive text-sm">Enter a task title.</p>}
          </div>
          <div className="space-y-2">
            {editing ? <DescriptionField initialValue={editing.description} disabled={busy} onChange={setDescription} onSave={async description => {
              setBusy(true);
              try {
                await notifyOperation(() => onSave({ ...editing, description }), {
                  loading: 'Saving description…',
                  success: 'Description saved.',
                  error: 'Could not save the description. Your draft is still open; try again.',
                });
                setSavedDescription(description);
                setDescription(description);
              } finally { setBusy(false); }
            }} /> : <>
              <Label htmlFor="task-description">Description</Label>
              <Textarea id="task-description" name="description" value={description} onChange={event => setDescription(event.target.value)} className="min-h-32 font-mono text-sm" aria-describedby="description-hint" />
              <p id="description-hint" className="text-muted-foreground text-xs">Markdown supported.</p>
            </>}
          </div>
          <div role="group" aria-label="Task properties" className="bg-muted/50 mt-6 flex flex-col gap-1 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
              <Label htmlFor="task-status" className="text-muted-foreground gap-2 leading-snug font-normal">
                Status
              </Label>
              <NativeSelect id="task-status" name="status" value={currentStatus} onChange={event => setSelectedStatus(event.target.value)} className="bg-background dark:bg-background h-10 w-32 rounded-lg border-transparent shadow-none hover:bg-accent sm:w-40">
                {columns.map((option) => <option key={option}>{option}</option>)}
              </NativeSelect>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
              <Label htmlFor="task-auto-workflow" className="text-muted-foreground font-normal">Auto-workflow</Label>
              <input id="task-auto-workflow" name="autoWorkflow" type="checkbox" checked={autoWorkflow}
                onChange={event => setAutoWorkflow(event.target.checked)} aria-describedby="auto-workflow-hint"
                className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
            </div>
            <p id="auto-workflow-hint" className="px-1 text-xs text-muted-foreground">Move to the next column when the agent completes successfully, and start its agent if assigned.</p>
            {pendingRun && <p className="px-1 text-xs text-muted-foreground">Moving this task stops its current run and queues work for the destination’s agent, if assigned. Deletion is available after execution stops.</p>}
          </div>
          {editing && <section aria-label="Comments" className="mt-8 space-y-5 border-t pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-muted-foreground size-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Comments</h3>
              <span className="text-muted-foreground text-xs tabular-nums">{editing.comments?.length ?? 0}</span>
            </div>
            {editing.comments?.length ? <ol className="space-y-6">{[...editing.comments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(comment => (
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
                    <CommentBody body={comment.body} />
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
              <Button type="submit" size="sm" disabled={busy || !canSave} className="px-3 text-xs" aria-label={editing ? "Save changes" : "Create task"}>{editing ? "Save" : "Create task"}</Button>
            </div>
          </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CommentBody({ body }: { body: string }) {
  const isLong = body.length > 600 || body.split('\n').length > 8;

  if (!isLong) return <Markdown>{body}</Markdown>;

  return <div className="relative [&:has(details[open])>.comment-preview]:hidden [&:has(details[open])>.comment-fade]:hidden">
    <div aria-hidden="true" className="comment-fade pointer-events-none absolute -inset-x-4 -bottom-3 h-12 rounded-b-2xl bg-linear-to-b from-transparent to-foreground/5" />
    <div className="comment-preview mb-3 max-h-36 overflow-hidden">
      <Markdown compact>{body.split('\n').slice(0, 6).join('\n')}</Markdown>
    </div>
    <details className="group/comment relative">
    <summary className="w-fit cursor-pointer rounded-sm text-xs font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
      <span className="group-open/comment:hidden">Show full comment</span>
      <span className="hidden group-open/comment:inline">Collapse comment</span>
    </summary>
    <div className="mt-3">
      <Markdown>{body}</Markdown>
    </div>
    </details>
  </div>;
}

function DescriptionField({ initialValue, disabled, onChange, onSave }: {
  initialValue: string;
  disabled: boolean;
  onChange: (description: string) => void;
  onSave: (description: string) => Promise<void>;
}) {
  const [description, setDescription] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  async function saveDescription() {
    const value = draft.trim();
    if (disabled || value === description.trim()) return;
    try {
      await onSave(value);
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
      <Textarea id="task-description" value={draft} onChange={event => { setDraft(event.target.value); onChange(event.target.value); }} autoFocus className="min-h-32 font-mono text-sm" aria-describedby="description-hint" />
      <div className="flex items-center justify-between gap-3">
        <p id="description-hint" className="text-muted-foreground text-xs">Markdown supported.</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" aria-label="Cancel description edit" onClick={() => { setIsEditing(false); onChange(description); }}>Cancel</Button>
          <Button type="button" size="sm" aria-label="Save description" disabled={disabled || draft.trim() === description.trim()} onClick={() => { void saveDescription(); }}>Save</Button>
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
