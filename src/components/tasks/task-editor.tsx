"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskChat } from "@/components/chat/task-chat";
import { commentChatDraft } from "@/domain/comment-reference";
import { TaskArtifacts } from "@/components/artifacts/artifact-attachments";
import type { ArtifactReference } from "@/domain/artifact";
import { useId, useRef, useState, type ComponentProps, type FormEvent } from "react";
import { Bot, Maximize2, Minimize2, LayoutGrid, CircleDot, CirclePlay, CircleStop, Workflow, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTabTrigger } from "./activity-tab-trigger";
import { TaskComments } from "./task-comments";
import { AgentStatus } from "./agent-status";
import { DescriptionField } from "./description-field";
import { notifyOperation, toast } from "@/components/ui/toast";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import type { AgentProfile, ColumnAssignment } from "@/domain/column-agent";
import { statuses, type Status, type Task } from "@/domain/task";

export type TaskEditorProps = {
  boards?: import("@/domain/task").Board[];
  boardId?: string;
  columns?: readonly string[];
  assignedColumns?: readonly string[];
  assignments?: readonly ColumnAssignment[];
  onRun?: () => Promise<void>;
  onStop?: () => Promise<void>;
  agents?: AgentProfile[];
  onDeleteComment?: (commentId: string) => Promise<void>;
  onPostComment?: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>;
  open: boolean;
  initialTab?: "detail" | "activity" | "chat";
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
  boards,
  boardId,
  columns: initialColumns = statuses,
  assignedColumns = [],
  assignments = [],
  onRun,
  onStop,
  open,
  initialTab = "detail",
  task: editing = null,
  defaultStatus = "To do",
  onOpenChange,
  onSave,
  onDelete,
  onAnswerFeedback,
  onPostComment,
  onDeleteComment,
  agents,
}: TaskEditorProps) {
  const formId = useId();
  const assignedAgent = agents?.find((agent) =>
    agent.id === assignments.find((assignment) => assignment.column === editing?.status)?.agentId,
  );
  const [selectedBoard, setSelectedBoard] = useState(editing?.boardId ?? boardId);
  const columns = selectedBoard === boardId ? initialColumns : (boards?.find((board) => board.id === selectedBoard)?.columns ?? initialColumns);
  const movedBoard = selectedBoard !== (editing?.boardId ?? boardId);
  const pendingRun =
    editing?.agentStatus === "Queued" || editing?.agentStatus === "Running";
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<string>(initialTab);
  const [chatDraft, setChatDraft] = useState("");
  const [chatDraftVersion, setChatDraftVersion] = useState(0);
  const [artifactCount, setArtifactCount] = useState(0);
  const draftId = useRef<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(!editing);
  const [titleError, setTitleError] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const currentStatus =
    selectedStatus !== null && columns.includes(selectedStatus)
      ? selectedStatus
      : (movedBoard ? columns[0] : editing?.status ?? defaultStatus);

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
  const [savedFields, setSavedFields] = useState(editing);
  const savedTask = useRef(editing);
  const saveQueue = useRef(Promise.resolve(true));
  const pendingSaves = useRef(0);
  const [saving, setSaving] = useState(false);
  const canSave =
    Boolean(title.trim()) &&
    (!editing ||
      title.trim() !== savedFields?.title.trim() ||
      description.trim() !== savedDescription.trim() ||
      movedBoard ||
      currentStatus !== savedFields?.status ||
      autoWorkflow !== (savedFields?.autoWorkflow ?? false) ||
      autoRun !== (savedFields?.autoRun ?? false));

  type EditableFields = Pick<Task, "title" | "description" | "status" | "boardId" | "autoWorkflow" | "autoRun">;

  function autosave(patch: Partial<EditableFields>): Promise<boolean> {
    if (!editing) return Promise.resolve(true);
    if (patch.title !== undefined && !patch.title.trim()) {
      setTitleError(true);
      return Promise.resolve(false);
    }
    pendingSaves.current += 1;
    setSaving(true);
    const operation = saveQueue.current.then(async () => {
      const previous = savedTask.current ?? editing;
      if (Object.entries(patch).every(([key, value]) => previous[key as keyof Task] === value)) return true;
      const next = { ...editing, ...previous, ...patch, comments: editing.comments, agentStatus: editing.agentStatus };
      try {
        await onSave(next);
        savedTask.current = next;
        setSavedFields(next);
        setSavedDescription(next.description);
        toast.success("Task saved.", { id: `${formId}-save` });
        return true;
      } catch {
        toast.error("Could not save changes. Your draft is still open.", {
          id: `${formId}-save`,
          duration: Infinity,
          action: { label: "Retry", onClick: () => { void autosave(patch); } },
        });
        return false;
      }
    }).finally(() => {
      pendingSaves.current -= 1;
      setSaving(pendingSaves.current > 0);
    });
    saveQueue.current = operation;
    return operation;
  }

  function saveDraft() {
    return autosave({ title: title.trim(), description: description.trim(), status: currentStatus,
      boardId: selectedBoard, autoWorkflow, autoRun });
  }

  async function closeEditor() {
    if (busy) return;
    if (editing && !(await saveDraft())) return;
    onOpenChange(false);
  }

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
    if (editing) { void saveDraft(); return; }
    if (busy || !canSave) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setTitleError(true);
      return;
    }
    const status =
      columns.find((value) => value === data.get("status")) ??
      defaultStatus;
    const agentStatus = "Not started";
    const description = String(data.get("description") ?? "").trim();
    void persist(async () => {
      await onSave({
        boardId: selectedBoard,
        id: (draftId.current ??= crypto.randomUUID()),
        title,
        description,
        status,
        agentStatus,
        autoWorkflow,
        autoRun,
        comments: [],
      });
      setSavedDescription(description);
    });
  }

  function navigateComment(commentId: string) {
    setTab("activity");
    requestAnimationFrame(() => {
      const comment = document.getElementById(`comment-${commentId}`);
      comment?.scrollIntoView({ block: "nearest" });
      comment?.focus({ preventScroll: true });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void closeEditor();
        else if (!busy) onOpenChange(true);
      }}
    >
      <DialogContent closeDisabled={busy} aria-describedby={undefined} size={expanded ? "expanded" : "large"} layout="workspace">
        <DialogHeader variant="task" className="w-[calc(100%+3rem)] max-w-5xl justify-self-center">
          <div className="col-start-1 row-start-1 min-w-0 space-y-2">
            {isEditingTitle ? <>
            <DialogTitle className="sr-only">{title.trim() || "Create task"}</DialogTitle>
            <Label htmlFor="task-title" className="sr-only">Title</Label>
            <Input
              id="task-title"
              form={formId}
              variant="title"
              value={title}
              disabled={busy}
              required
              autoFocus
              onBlur={() => {
                if (title.trim()) setIsEditingTitle(false);
                void autosave({ title: title.trim() });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && title.trim()) {
                  event.preventDefault();
                  setIsEditingTitle(false);
                  void autosave({ title: title.trim() });
                }
                if (event.key === "Escape" && editing) {
                  event.preventDefault();
                  event.stopPropagation();
                  setTitle(savedTask.current?.title ?? editing.title);
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
              <DialogTitle asChild>
              <TaskTitle>
                <TaskTitleButton title={title} disabled={busy} onClick={() => setIsEditingTitle(true)}>{title}</TaskTitleButton>
              </TaskTitle>
              </DialogTitle>
            )}
            {titleError && (
              <p id="title-error" className="text-destructive text-sm">
                Enter a task title.
              </p>
            )}
          </div>

          <div className="col-start-2 row-start-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={expanded ? "Collapse task panel" : "Expand task panel"}
                    aria-pressed={expanded}
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{expanded ? "Collapse task panel" : "Expand task panel"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>
        <form
          id={formId}
          onSubmit={saveTask}
          key={editing?.id ?? "new"}
          className="min-h-0 min-w-0 w-[calc(100%+3rem)] max-w-5xl justify-self-center"
        >
          <Tabs value={tab} onValueChange={setTab} asChild>
          <fieldset disabled={busy} className="flex h-full min-h-0 min-w-0 flex-col">
            <input type="hidden" name="title" value={title} />
            {editing && <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
              <TabsList layout="wrap" aria-label="Task sections">
                <TabsTrigger value="detail" disabled={busy}>Detail</TabsTrigger>
                <ActivityTabTrigger value="activity" disabled={busy} agentStatus={editing.agentStatus} comments={editing.comments} />
                <TabsTrigger value="artifacts" disabled={busy} aria-label="Artifacts" aria-description={`${artifactCount} artifacts`}>Artifacts<TabsCount count={artifactCount} /></TabsTrigger>
                <TabsTrigger value="chat" disabled={busy}>Chat</TabsTrigger>
              </TabsList>
              {editing && ((onRun && !pendingRun) || (pendingRun && onStop)) && (
              <div className="ml-auto flex min-w-0 max-w-full items-center gap-2">
                {assignedAgent && (
                  <Label variant="metadata" asChild className="min-w-0">
                    <span title={assignedAgent.name}><span className="truncate">{assignedAgent.name}</span></span>
                  </Label>
                )}
                {editing && onRun && !pendingRun && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button type="button" size="sm" variant="ghost-primary" disabled={busy || saving || canSave || !title.trim() || editing.agentStatus === "Waiting" || !assignedColumns.includes(editing.status)} onClick={async () => {
                            setBusy(true);
                            try {
                              await notifyOperation(onRun, { loading: "Queuing agent…", success: "Agent queued.", error: "Could not start the agent. Reload the task and try again." });
                            } catch {
                              /* The toast reports the failure; keep the task open. */
                            } finally {
                              setBusy(false);
                            }
                          }}><CirclePlay className="size-4" aria-hidden="true" />{editing.agentStatus === "Stopped" ? "Run again" : "Run"}</Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {canSave ? "Leave the edited field to save before running the agent." : editing.agentStatus === "Waiting" ? "Answer the pending feedback first." : !assignedColumns.includes(editing.status) ? "Assign an agent to this column first." : editing.agentStatus === "Stopped" ? "Request a new run using saved work and history." : "Run the current column’s agent using the saved task details."}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {editing && pendingRun && onStop && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="sm" variant="ghost-primary" disabled={busy} onClick={async () => {
                          if (busy) return;
                          setBusy(true);
                          try {
                            await notifyOperation(onStop, {
                              loading: "Stopping task…",
                              success: "Task stop requested.",
                              error: "Could not update execution. Reload the task and try again.",
                            });
                          } catch {
                            /* The toast reports the failure; keep the task open. */
                          } finally {
                            setBusy(false);
                          }
                        }}>
                          <CircleStop className="size-4" aria-hidden="true" />
                          Stop
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Stop this task and preserve saved work. Other tasks will continue running.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              )}
            </div>}
            <ScrollArea className="min-h-0 flex-1"><div className="px-6 pt-1 pb-6">
              <TabsContent value="detail" forceMount className="space-y-7">
              <div
                role="group"
                aria-label="Task properties"
                className="space-y-3"
              >
                <TooltipProvider>
                  <div className="flex flex-col gap-4">
                    {boards && boards.length > 0 && <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                      <Label htmlFor="task-board-select" variant="metadata"><LayoutGrid className="size-4 shrink-0" aria-hidden="true" />Board</Label>
                      <NativeSelect id="task-board-select" value={selectedBoard} disabled={busy || pendingRun} title={pendingRun ? "Stop or finish the agent run before moving boards." : undefined} variant="status" className="w-full max-w-48" onChange={(event) => {
                        setSelectedBoard(event.target.value);
                        const status = boards.find((board) => board.id === event.target.value)?.columns[0] ?? currentStatus;
                        setSelectedStatus(status);
                        void autosave({ boardId: event.target.value, status });
                      }}>
                        {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
                      </NativeSelect>
                    </div>}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                          <Label
                            htmlFor="task-status"
                            variant="metadata"
                          >
                            <CircleDot className="size-4 shrink-0" aria-hidden="true" />
                            Status
                          </Label>
                          <NativeSelect
                            id="task-status"
                            name="status"
                            value={currentStatus}
                            onChange={(event) => { setSelectedStatus(event.target.value); void autosave({ status: event.target.value }); }}
                            variant="status" className="w-full max-w-48"
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
                    {editing && (
                      <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                        <span className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Bot className="size-4 shrink-0" aria-hidden="true" />
                          Agent status
                        </span>
                        <div role="status">
                          <AgentStatus status={editing.agentStatus} variant="badge" />
                        </div>
                      </div>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                          <Label
                            htmlFor="task-auto-workflow"
                            variant="metadata"
                          >
                            <Workflow className="size-4 shrink-0" aria-hidden="true" />
                            Auto-workflow
                          </Label>
                          <Switch
                            id="task-auto-workflow"
                            name="autoWorkflow"
                            checked={autoWorkflow}
                            onCheckedChange={(value) => { setAutoWorkflow(value); void autosave({ autoWorkflow: value }); }}
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
                        <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                          <Label htmlFor="task-auto-run" variant="metadata"><Zap className="size-4 shrink-0" aria-hidden="true" />Auto-run</Label>
                          <Switch id="task-auto-run" name="autoRun" checked={autoRun} onCheckedChange={(value) => { setAutoRun(value); void autosave({ autoRun: value }); }} disabled={busy} />
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
              <div className="min-w-0">
                {editing ? (
                  <DescriptionField
                    agents={agents}
                    value={description}
                    disabled={busy}
                    onChange={setDescription}
                    onBlur={() => autosave({ description: description.trim() })}
                  />
                ) : (
                  <>
                    <input type="hidden" name="description" value={description} />
                    <DescriptionEditor
                      agents={agents ?? []}
                      artifacts
                      controlsOnFocus
                      value={description}
                      onChange={setDescription}
                      disabled={busy}
                    />
                  </>
                )}
              </div>
              </TabsContent>
              {editing && <TabsContent value="activity" forceMount>
                <TaskComments active={tab === "activity"} onChat={(comment) => {
                  setChatDraft((draft) => `${draft}${draft.trim() ? "\n\n" : ""}${commentChatDraft(comment, agents ?? [])}`);
                  setChatDraftVersion((version) => version + 1);
                  setTab("chat");
                }} taskId={editing.id} embedded comments={editing.comments} agentStatus={editing.agentStatus} onAnswerFeedback={onAnswerFeedback} agents={agents} onPostComment={onPostComment} onDeleteComment={onDeleteComment} />
              </TabsContent>}
              {editing && <TabsContent value="chat" forceMount><TaskChat taskId={editing.id} active={tab === "chat"} agents={agents} body={chatDraft} onBodyChange={setChatDraft} draftVersion={chatDraftVersion} onNavigateComment={navigateComment} /></TabsContent>}
              {editing && <TabsContent value="artifacts" forceMount>
                <TaskArtifacts
                  taskId={editing.id}
                  commentsKey={JSON.stringify((editing.comments ?? []).map((comment) => comment.id))}
                  onCountChange={setArtifactCount}
                  onNavigateComment={navigateComment}
                />
              </TabsContent>}
            </div></ScrollArea>
            <DialogFooter variant="task">
              {editing && onDelete && (
                <Button
                  type="button"
                  variant="ghost-destructive"
                  size="sm"
                  aria-label="Delete task"
                  disabled={pendingRun || saving}
                  className="mr-auto"
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                >
                  Delete
                </Button>
              )}
              {!editing && <div className="flex items-center gap-1.5">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost-muted"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !canSave}
                  aria-label="Create task"
                >
                  Create task
                </Button>
              </div>}
            </DialogFooter>
          </fieldset>
          </Tabs>
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

function TaskTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn(className, "min-w-0 text-left text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl")} {...props} />;
}

function TaskTitleButton(props: ComponentProps<"button">) {
  return <button type="button" aria-label="Edit title" className="block w-full truncate rounded-md text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" {...props} />;
}
