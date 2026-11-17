"use client";

import { useRef, useState, type FormEvent } from "react";
import { TaskComments } from "./task-comments";
import { AgentStatus } from "./agent-status";
import { DescriptionField } from "./description-field";
import { notifyOperation } from "@/components/ui/toast";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import { statuses, type Status, type Task } from "@/domain/task";

export type TaskEditorProps = {
  columns?: readonly string[];
  assignedColumns?: readonly string[];
  onRun?: () => Promise<void>;
  agents?: AgentProfile[];
  onPostComment?: (body: string) => Promise<void>;
  open: boolean;
  task?: Task | null;
  defaultStatus?: Status;
  onOpenChange: (open: boolean) => void;
  onSave: (task: Task) => void | Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string) => Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

export function TaskEditor(props: TaskEditorProps) {
  return (
    <TaskEditorSession
      key={`${props.task?.id ?? "new"}:${props.open}`}
      {...props}
    />
  );
}

function TaskEditorSession({
  columns = statuses,
  assignedColumns = [],
  onRun,
  open,
  task: editing = null,
  defaultStatus = "To do",
  onOpenChange,
  onSave,
  onDelete,
  onAnswerFeedback,
  onPostComment,
  agents,
}: TaskEditorProps) {
  const pendingRun =
    editing?.agentStatus === "Queued" || editing?.agentStatus === "Running";
  const draftId = useRef<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(!editing);
  const [titleError, setTitleError] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const currentStatus =
    selectedStatus !== null && columns.includes(selectedStatus)
      ? selectedStatus
      : (editing?.status ?? defaultStatus);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoWorkflow, setAutoWorkflow] = useState(
    editing?.autoWorkflow ?? false,
  );
  const [autoRun, setAutoRun] = useState(editing?.autoRun ?? false);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [savedDescription, setSavedDescription] = useState(
    editing?.description ?? "",
  );
  const canSave =
    Boolean(title.trim()) &&
    (!editing ||
      title.trim() !== editing.title.trim() ||
      description.trim() !== savedDescription.trim() ||
      currentStatus !== editing.status ||
      autoWorkflow !== (editing.autoWorkflow ?? false) ||
      autoRun !== (editing.autoRun ?? false));

  async function persist(
    operation: () => void | Promise<void>,
    deleting = false,
  ) {
    setBusy(true);
    try {
      await notifyOperation(operation, {
        loading: deleting ? "Deleting task…" : "Saving task…",
        success: deleting
          ? "Task deleted."
          : editing
            ? "Task saved."
            : "Task created.",
        error: deleting
          ? "Could not confirm the task was deleted. Try again or reload to check."
          : "Could not confirm changes were saved. Try again to save your draft.",
      });
      draftId.current = null;
      setSelectedStatus(null);
      if (deleting) onOpenChange(false);
    } catch {
      /* Keep the draft open; notifyOperation reports the failure. */
    } finally {
      setBusy(false);
    }
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
    const status =
      columns.find((value) => value === data.get("status")) ??
      editing?.status ??
      defaultStatus;
    const agentStatus = editing?.agentStatus ?? "Not started";
    const description = String(data.get("description") ?? "").trim();
    void persist(async () => {
      await onSave({
        id: editing?.id ?? (draftId.current ??= crypto.randomUUID()),
        title,
        description,
        status,
        agentStatus,
        autoWorkflow,
        autoRun,
        comments: editing?.comments ?? [],
      });
      setSavedDescription(description);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) {
          if (!nextOpen) {
            draftId.current = null;
            setSelectedStatus(null);
          }
          setTitleError(false);
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent aria-describedby={editing ? undefined : "create-task-description"} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-3xl sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-6">
            <DialogTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{editing ? "Edit task" : "Create task"}</DialogTitle>
            {pendingRun && (
              <div role="status" className="rounded-full border bg-muted/50 px-2.5 py-1">
                <AgentStatus status={editing!.agentStatus} className="font-medium" />
              </div>
            )}
          </div>
          {!editing && <DialogDescription id="create-task-description">Add a task to the board.</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={saveTask}
          key={editing?.id ?? "new"}
          className="space-y-4"
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <input type="hidden" name="title" value={title} />
              {isEditingTitle ? <>
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                className="h-auto py-2 text-xl font-semibold tracking-tight md:text-2xl"
                value={title}
                required
                autoFocus
                onBlur={() => { if (title.trim()) setIsEditingTitle(false); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && title.trim()) {
                    event.preventDefault();
                    setIsEditingTitle(false);
                  }
                  if (event.key === "Escape" && editing) {
                    event.preventDefault();
                    event.stopPropagation();
                    setTitle(editing.title);
                    setIsEditingTitle(false);
                  }
                }}
                aria-invalid={titleError}
                aria-describedby={titleError ? "title-error" : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleError(false);
                }}
              />
              </> : (
                <h2 className="text-2xl font-semibold leading-tight tracking-tight break-words">
                  <button type="button" aria-label="Edit title" className="w-full rounded-md text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setIsEditingTitle(true)}>{title}</button>
                </h2>
              )}
              {titleError && (
                <p id="title-error" className="text-destructive text-sm">
                  Enter a task title.
                </p>
              )}
            </div>
            <div className="space-y-2">
              {editing ? (
                <DescriptionField
                  initialValue={editing.description}
                  disabled={busy}
                  onChange={setDescription}
                  onSave={async (description) => {
                    setBusy(true);
                    try {
                      await notifyOperation(
                        () => onSave({ ...editing, description }),
                        {
                          loading: "Saving description…",
                          success: "Description saved.",
                          error:
                            "Could not save the description. Your draft is still open; try again.",
                        },
                      );
                      setSavedDescription(description);
                      setDescription(description);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ) : (
                <>
                  <Label htmlFor="task-description">Description</Label>
                  <input type="hidden" name="description" value={description} />
                  <DescriptionEditor
                    value={description}
                    onChange={setDescription}
                    disabled={busy}
                  />
                </>
              )}
            </div>
            <div
              role="group"
              aria-label="Task properties"
              className="bg-muted/50 flex flex-col gap-2 rounded-lg p-2.5"
            >
              <TooltipProvider>
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="task-status"
                          className="text-muted-foreground gap-2 leading-snug font-normal"
                        >
                          Status
                        </Label>
                        <NativeSelect
                          id="task-status"
                          name="status"
                          value={currentStatus}
                          onChange={(event) => setSelectedStatus(event.target.value)}
                          className="bg-background dark:bg-background h-8 w-32 rounded-md border-transparent py-1 shadow-none hover:bg-accent"
                        >
                          {columns.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </NativeSelect>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Choose the task’s board column. Its assigned agent starts on entry only when Auto-run is enabled.
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex h-8 items-center gap-2">
                        <Label
                          htmlFor="task-auto-workflow"
                          className="text-muted-foreground font-normal"
                        >
                          Auto-workflow
                        </Label>
                        <Switch
                          id="task-auto-workflow"
                          name="autoWorkflow"
                          checked={autoWorkflow}
                          onCheckedChange={setAutoWorkflow}
                          disabled={busy}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Move to the next column when the agent completes successfully. Its agent starts only when Auto-run is enabled.
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex h-8 items-center gap-2">
                        <Label htmlFor="task-auto-run" className="text-muted-foreground font-normal">Auto-run</Label>
                        <Switch id="task-auto-run" name="autoRun" checked={autoRun} onCheckedChange={setAutoRun} disabled={busy} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Automatically start the assigned agent when this task enters a column. Leave off to start it with Run.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              {pendingRun && (
                <p className="text-xs text-muted-foreground">
                  Moving this task stops its current run. The destination’s agent
                  starts only when Auto-run is enabled. Deletion is available after execution stops.
                </p>
              )}
            </div>
            {editing && <TaskComments comments={editing.comments} agentStatus={editing.agentStatus} onAnswerFeedback={onAnswerFeedback} agents={agents} onPostComment={onPostComment} />}
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
                    setConfirmDelete(true);
                  }}
                >
                  Delete
                </Button>
              )}
              <div className="flex items-center gap-1.5">
                {editing && onRun && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button type="button" size="sm" variant="outline" disabled={busy || pendingRun || canSave || editing.agentStatus === "Waiting" || !assignedColumns.includes(editing.status)} onClick={async () => {
                            setBusy(true);
                            try {
                              await notifyOperation(onRun, { loading: "Queuing agent…", success: "Agent queued.", error: "Could not start the agent. Reload the task and try again." });
                            } catch {
                              /* The toast reports the failure; keep the task open. */
                            } finally {
                              setBusy(false);
                            }
                          }}>Run</Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {canSave ? "Save your changes before running the agent." : pendingRun ? "An agent is already queued or running." : editing.agentStatus === "Waiting" ? "Answer the pending feedback first." : !assignedColumns.includes(editing.status) ? "Assign an agent to this column first." : "Run the current column’s agent using the saved task details."}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground px-2 text-xs"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !canSave}
                  className="px-3 text-xs"
                  aria-label={editing ? "Save changes" : "Create task"}
                >
                  {editing ? "Save" : "Create task"}
                </Button>
              </div>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
      {editing && onDelete && (
        <DeleteConfirmation
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete task?"
          description={`Delete “${editing.title}” and its comments? This cannot be undone.`}
          busy={busy}
          onConfirm={() => {
            if (!busy && !pendingRun) void persist(() => onDelete(editing.id), true);
          }}
        />
      )}
    </Dialog>
  );
}
