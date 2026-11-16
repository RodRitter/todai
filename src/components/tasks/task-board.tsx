"use client";

import { useRef, useState, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useBoardMotion } from "@/hooks/use-board-motion";
import { statuses, type Status, type Task } from "./task";
import { TaskCard } from "./task-card";
import { TaskColumn } from "./task-column";
import { ColumnAgentEditor } from "./column-agent-editor";
import type { ColumnAgent } from "./column-agent";
import { TaskEditor } from "./task-editor";

export function TaskBoard({ initialTasks = [], initialAgents = [], saveAgent, persistence }: {
  initialTasks?: Task[];
  initialAgents?: ColumnAgent[];
  saveAgent?: (agent: ColumnAgent) => Promise<ColumnAgent>;
  persistence?: { save: (task: Task) => Promise<Task>; delete: (id: string) => Promise<void> };
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [configuringColumn, setConfiguringColumn] = useState<Status | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<Status | null>(null);
  const { boardRef, capturePositions } = useBoardMotion(tasks);

  function updateTasks(update: SetStateAction<Task[]>) {
    capturePositions();
    setTasks(update);
  }

  async function mutate(operation: () => Promise<void>) {
    if (saving.current) throw new Error('Wait for the current save to finish.');
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
          {statuses.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column);
            return (
              <TaskColumn
                key={column}
                status={column}
                agentName={agents.find(agent => agent.column === column)?.name}
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
        {configuringColumn && <ColumnAgentEditor
          column={configuringColumn}
          agent={agents.find(agent => agent.column === configuringColumn)}
          onClose={() => setConfiguringColumn(null)}
          onSave={async agent => {
            const saved = saveAgent ? await saveAgent(agent) : agent;
            setAgents(current => [...current.filter(item => item.column !== saved.column), saved]);
          }}
        />}
        <TaskEditor
          key={editing?.id ?? "new"}
          open={open}
          task={editing}
          onOpenChange={setOpen}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      </main>
    </AppShell>
  );
}
