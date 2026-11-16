"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { notifyOperation, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useBoardMotion } from "@/hooks/use-board-motion";
import { statuses, type Status, type Task } from "./task";
import { TaskCard } from "./task-card";
import { TaskColumn } from "./task-column";
import { ColumnAgentPicker } from "./column-agent-picker";
import type { AgentProfile, ColumnAssignment } from "./column-agent";
import { TaskEditor } from "./task-editor";

export function TaskBoard({ columns = statuses, initialTasks = [], initialAgents = [], initialAssignments = [], assignAgent, persistence }: {
  columns?: readonly string[];
  initialTasks?: Task[];
  initialAgents?: AgentProfile[];
  initialAssignments?: ColumnAssignment[];
  assignAgent?: (column: Status, agentId: string | null) => Promise<ColumnAssignment | null>;
  persistence?: { list?: () => Promise<Task[]>; save: (task: Task) => Promise<Task>; delete: (id: string) => Promise<void> };
}) {
  const agents = initialAgents;
  const [assignments, setAssignments] = useState(initialAssignments);
  const [configuringColumn, setConfiguringColumn] = useState<Status | null>(null);
  const saving = useRef(false);
  const revision = useRef(0);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
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
        if (active && !saving.current && before === revision.current) setTasks(latest);
        if (active && errorToast !== undefined) { toast.dismiss(errorToast); errorToast = undefined; }
      } catch {
        if (active && errorToast === undefined) errorToast = toast.error('Live task updates are unavailable. Retrying…', { duration: Infinity });
      } finally { if (active) timer = setTimeout(poll, 1000); }
    }
    timer = setTimeout(poll, 1000);
    return () => { active = false; clearTimeout(timer); if (errorToast !== undefined) toast.dismiss(errorToast); };
  }, [refresh]);

  function updateTasks(update: SetStateAction<Task[]>) {
    capturePositions();
    setTasks(update);
  }

  async function mutate(operation: () => Promise<void>) {
    if (saving.current) throw new Error('Wait for the current save to finish.');
    revision.current++;
    saving.current = true;
    setBusy(true);
    try { await operation(); }
    finally { saving.current = false; setBusy(false); }
  }

  function saveTask(task: Task) {
    return mutate(async () => {
      const saved = persistence ? await persistence.save(task) : task;
      updateTasks(current => current.some(item => item.id === saved.id)
        ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
    });
  }

  function deleteTask(id: string) {
    return mutate(async () => {
      await persistence?.delete(id);
      updateTasks(current => current.filter(task => task.id !== id));
    });
  }

  function openEditor(task: Task | null = null) {
    setEditing(task);
    setOpen(true);
  }

  function endDrag() {
    setDraggedTaskId(null);
    setDropColumn(null);
  }

  return (
    <AppShell headerActions={
      <Button size="sm" disabled={busy} onClick={() => openEditor()}><Plus /> New task</Button>
    }>
      <main id="task-board" className="flex min-h-[calc(100dvh-3.5rem)] flex-col p-4 md:p-8" aria-label="Task board" tabIndex={-1}>
        <div ref={boardRef} className="grid flex-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column);
            return (
              <TaskColumn
                key={column}
                status={column}
                agentName={agents.find(agent => agent.id === assignments.find(item => item.column === column)?.agentId)?.name}
                onConfigureAgent={() => setConfiguringColumn(column)}
                isEmpty={columnTasks.length === 0}
                isDropTarget={dropColumn === column}
                canDrop={!busy && draggedTaskId !== null}
                onDragOver={() => setDropColumn(column)}
                onDragLeave={() => setDropColumn(null)}
                onDrop={() => {
                  const task = tasks.find(item => item.id === draggedTaskId);
                  if (task && task.status !== column && !saving.current) void notifyOperation(() => saveTask({ ...task, status: column }), {
                    loading: "Moving task…",
                    success: `Task moved to ${column}.`,
                    error: "Could not confirm the move was saved. Try again or reload to check its saved column.",
                  }).catch(() => {});
                  endDrag();
                }}
              >
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggedTaskId === task.id}
                    onEdit={(task) => { if (!busy) openEditor(task); }}
                    onDragStart={(dragged) => setDraggedTaskId(dragged.id)}
                    onDragEnd={endDrag}
                  />
                ))}
              </TaskColumn>
            );
          })}
        </div>
        {configuringColumn && <ColumnAgentPicker
          column={configuringColumn}
          agents={agents}
          agentId={assignments.find(item => item.column === configuringColumn)?.agentId}
          onClose={() => setConfiguringColumn(null)}
          onSave={async agentId => {
            const saved = assignAgent ? await assignAgent(configuringColumn, agentId) : agentId ? { column: configuringColumn, agentId } : null;
            setAssignments(current => [...current.filter(item => item.column !== configuringColumn), ...(saved ? [saved] : [])]);
          }}
        />}
        <TaskEditor
          key={editing?.id ?? "new"}
          columns={columns}
          defaultStatus={columns[0]}
          open={open}
          task={editing ? tasks.find(task => task.id === editing.id) ?? editing : null}
          onOpenChange={setOpen}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      </main>
    </AppShell>
  );
}
