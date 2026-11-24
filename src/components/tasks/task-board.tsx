"use client";

import type { ArtifactReference } from "@/domain/artifact";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { notifyOperation, toast } from "@/components/ui/toast";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { BoardSnapshot } from "@/lib/workspace-api";
import { useBoardMotion } from "@/hooks/use-board-motion";
import { statuses, type Status, type Task } from "@/domain/task";
import { TaskCard } from "./task-card";
import { ColumnSettingsDialog } from "./column-settings-dialog";
import { TaskColumn } from "./task-column";
import { ColumnAgentPicker } from "./column-agent-picker";
import { type AgentProfile, type ColumnAssignment } from "@/domain/column-agent";
import { TaskEditor } from "./task-editor";

export function TaskBoard({
  boards,
  boardId,
  columns: initialColumns = statuses,
  initialTasks = [],
  initialAgents = [],
  initialAssignments = [],
  initialColumnInstructions = {},
  initialCompletionColumn = null,
  initialTaskId,
  configureColumn,
  assignAgent,
  persistence,
}: {
  boards?: import("@/domain/task").Board[];
  boardId?: string;
  columns?: readonly string[];
  initialTasks?: Task[];
  initialAgents?: AgentProfile[];
  initialAssignments?: ColumnAssignment[];
  initialColumnInstructions?: Record<string, string>;
  initialCompletionColumn?: string | null;
  initialTaskId?: string;
  configureColumn?: (column: string, name: string, instructions: string, completion?: boolean) => Promise<string[]>;
  assignAgent?: (
    column: Status,
    agentId: string | null,
  ) => Promise<ColumnAssignment | null>;
  persistence?: {
    list?: () => Promise<Task[] | BoardSnapshot>;
    save: (task: Task) => Promise<Task>;
    delete: (id: string) => Promise<void>;
    reset?: (taskId: string) => Promise<Task>;
    run?: (taskId: string) => Promise<Task>;
    stop?: (taskId: string) => Promise<Task>;
    deleteComment?: (taskId: string, commentId: string) => Promise<Task>;
    postComment?: (taskId: string, body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<Task>;
    answerFeedback?: (taskId: string, commentId: string, body: string) => Promise<Task>;
  };
}) {
  const [agents] = useState(initialAgents);
  const [columns, setColumns] = useState(initialColumns);
  const [completionColumn, setCompletionColumn] = useState(initialCompletionColumn);
  const [columnInstructions, setColumnInstructions] = useState(initialColumnInstructions);
  const columnFocus = useRef<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<{ name: string; instructions: string } | null>(null);
  const [assignments, setAssignments] = useState(initialAssignments);
  const saving = useRef(false);
  const revision = useRef(0);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [initialTab, setInitialTab] = useState<"detail" | "activity">(initialTaskId ? "activity" : "detail");
  const [open, setOpen] = useState(!!initialTaskId && initialTasks.some((task) => task.id === initialTaskId));
  const [editing, setEditing] = useState<Task | null>(initialTasks.find((task) => task.id === initialTaskId) ?? null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<Status | null>(null);
  const { boardRef, capturePositions } = useBoardMotion(tasks);

  const refresh = persistence?.list;
  useEffect(() => {
    if (!refresh) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let errorToast: string | number | undefined;
    async function poll() {
      const before = revision.current;
      try {
        const latest = await refresh!();
        if (active && !saving.current && before === revision.current) {
          if (Array.isArray(latest)) setTasks(latest);
          else {
            setTasks(latest.tasks);
            setColumns(latest.columns);
            setAssignments(latest.assignments);
            setColumnInstructions(latest.columnInstructions ?? {});
            setCompletionColumn(latest.completionColumn ?? null);
          }
        }
        if (active && errorToast !== undefined) {
          toast.dismiss(errorToast);
          errorToast = undefined;
        }
      } catch {
        if (active && errorToast === undefined)
          errorToast = toast.error(
            "Live task updates are unavailable. Retrying…",
            { duration: Infinity },
          );
      } finally {
        if (active) timer = setTimeout(poll, 1000);
      }
    }
    timer = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
      if (errorToast !== undefined) toast.dismiss(errorToast);
    };
  }, [refresh]);

  function updateTasks(update: SetStateAction<Task[]>) {
    capturePositions();
    setTasks(update);
  }

  async function mutate(operation: () => Promise<void>) {
    if (saving.current) throw new Error("Wait for the current save to finish.");
    revision.current++;
    saving.current = true;
    setBusy(true);
    try {
      await operation();
    } finally {
      revision.current++;
      saving.current = false;
      setBusy(false);
    }
  }

  function saveTask(task: Task) {
    return mutate(async () => {
      const saved = persistence ? await persistence.save(task) : task;
      if (boardId && saved.boardId !== boardId) {
        updateTasks((current) => current.filter((item) => item.id !== saved.id));
        setOpen(false);
        return;
      }
      updateTasks((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved],
      );
    });
  }

  function deleteTask(id: string) {
    return mutate(async () => {
      await persistence?.delete(id);
      updateTasks((current) => current.filter((task) => task.id !== id));
    });
  }

  function openEditor(task: Task | null = null, tab: "detail" | "activity" = "detail") {
    setInitialTab(tab);
    setEditing(task);
    setOpen(true);
  }

  function endDrag() {
    setDraggedTaskId(null);
    setDropColumn(null);
  }

  return (
    <AppShell
      boardName={boards?.find((board) => board.id === boardId)?.name}
      headerActions={
        <Button size="sm" disabled={busy} onClick={() => openEditor()}>
          <Plus /> New task
        </Button>
      }
    >
      <main
        id="task-board"
        className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-muted/40 p-4 md:p-8"
        aria-label="Task board"
        tabIndex={-1}
      >
        <div
          ref={boardRef}
          className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] items-stretch gap-2"
        >
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column);
            return (
              <TaskColumn
                key={column}
                status={column}
                configureDisabled={busy}
                onConfigure={configureColumn || !persistence ? () => { columnFocus.current = column; setEditingColumn({ name: column, instructions: columnInstructions[column] ?? "" }); } : undefined}
                agentSelector={completionColumn === column ? <Label variant="metadata">Memory</Label> :
                  <ColumnAgentPicker
                    column={column}
                    agents={agents}
                    agentId={assignments.find((item) => item.column === column)?.agentId}
                    disabled={busy}
                    onSave={(agentId) =>
                      mutate(async () => {
                        const saved = assignAgent
                          ? await assignAgent(column, agentId)
                          : agentId ? { column, agentId } : null;
                        setAssignments((current) => [
                          ...current.filter((item) => item.column !== column),
                          ...(saved ? [saved] : []),
                        ]);
                      })
                    }
                  />
                }
                isEmpty={columnTasks.length === 0}
                isDropTarget={dropColumn === column}
                canDrop={!busy && draggedTaskId !== null}
                onDragOver={() => setDropColumn(column)}
                onDragLeave={() => setDropColumn(null)}
                onDrop={() => {
                  const task = tasks.find((item) => item.id === draggedTaskId);
                  if (task && task.status !== column && !saving.current)
                    void notifyOperation(
                      () => saveTask({ ...task, status: column }),
                      {
                        loading: "Moving task…",
                        success: `Task moved to ${column}.`,
                        error:
                          "Could not confirm the move was saved. Try again or reload to check its saved column.",
                      },
                    ).catch(() => {});
                  endDrag();
                }}
              >
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggedTaskId === task.id}
                    onEdit={(task, tab) => {
                      if (!busy) openEditor(task, tab);
                    }}
                    onDragStart={(dragged) => setDraggedTaskId(dragged.id)}
                    onDragEnd={endDrag}
                  />
                ))}
              </TaskColumn>
            );
          })}
        </div>
        {editingColumn && <ColumnSettingsDialog completion={completionColumn === editingColumn.name} column={editingColumn.name} instructions={editingColumn.instructions} open
          restoreFocus={() => {
            const button = Array.from(boardRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.getAttribute("aria-label") === `Edit ${columnFocus.current} column settings`);
            button?.focus();
          }}
          onOpenChange={(open) => { if (!open) setEditingColumn(null); }}
          onSave={(name, instructions, completion) => mutate(async () => {
            const previous = editingColumn.name;
            if (!columns.includes(previous)) throw new Error("This column changed. Close settings and try again.");
            if (columns.some((column) => column !== previous && column.toLowerCase() === name.toLowerCase()))
              throw new Error("A column with that name already exists.");
            const next = configureColumn ? await configureColumn(previous, name, instructions, completion) : columns.map((column) => column === previous ? name : column);
            columnFocus.current = name;
            setCompletionColumn((current) => completion ? name : current === previous ? null : current);
            setColumns(next);
            setColumnInstructions((current) => ({ ...current, [name]: instructions }));
            setAssignments((current) => current.map((assignment) => assignment.column === previous ? { ...assignment, column: name } : assignment));
            updateTasks((current) => current.map((task) => task.status === previous ? { ...task, status: name } : task));
            window.dispatchEvent(new Event("todai:boards-changed"));
          })} />}
        <TaskEditor
          boards={boards}
          boardId={boardId}
          key={editing?.id ?? "new"}
          columns={columns}
          defaultStatus={columns[0]}
          open={open}
          initialTab={initialTab}
          task={
            editing
              ? (tasks.find((task) => task.id === editing.id) ?? editing)
              : null
          }
          onOpenChange={setOpen}
          agents={agents}
          onDeleteComment={persistence?.deleteComment ? (commentId) => mutate(async () => {
            const saved = await persistence.deleteComment!(editing!.id, commentId);
            updateTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
          }) : undefined}
          onPostComment={persistence?.postComment ? (body, artifacts, parentCommentId) => mutate(async () => {
            const saved = await persistence.postComment!(editing!.id, body, artifacts, parentCommentId);
            updateTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
          }) : undefined}
          onAnswerFeedback={persistence?.answerFeedback ? (commentId, body) => mutate(async () => {
            const saved = await persistence.answerFeedback!(editing!.id, commentId, body);
            updateTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
          }) : undefined}
          assignments={assignments}
          completionColumn={completionColumn}
          assignedColumns={assignments.map((assignment) => assignment.column)}
          onRun={persistence?.run ? () => mutate(async () => {
            const saved = await persistence.run!(editing!.id);
            updateTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
          }) : undefined}
          onStop={persistence?.stop ? () => mutate(async () => {
            const saved = await persistence.stop!(editing!.id);
            updateTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
          }) : undefined}
          onSave={async (task) => {
            await saveTask(task);
            setEditing(task);
          }}
          onDelete={deleteTask}
          onReset={persistence?.reset ? (taskId) => mutate(async () => {
            const saved = await persistence.reset!(taskId);
            updateTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
            setEditing(saved);
          }) : undefined}
        />
      </main>
    </AppShell>
  );
}
