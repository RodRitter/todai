"use client";

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { TaskBoard } from './task-board';
import type { ColumnAgent } from './column-agent';
import type { Task } from './task';

async function requestBoardData(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error ?? 'Could not save changes. Try again.');
  }
  return response.status === 204 ? undefined : response.json();
}

export function PersistentTaskBoard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [agents, setAgents] = useState<ColumnAgent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading('Loading tasks…');
    Promise.all([requestBoardData('/api/tasks'), requestBoardData('/api/column-agents')]).then(([tasks, agents]) => {
      if (active) { setTasks(tasks); setAgents(agents); toast.dismiss(id); }
    }).catch(() => {
      if (active) {
        setFailed(true);
        toast.error('Could not load the board. Check local database access and try again.', { id, duration: Infinity });
      }
    });
    return () => { active = false; toast.dismiss(id); };
  }, [attempt]);
  if (!tasks || !agents) return <main className="p-8" aria-busy={!failed}>
    {failed && <Button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry loading tasks</Button>}
  </main>;
  return <TaskBoard initialTasks={tasks} initialAgents={agents}
    saveAgent={agent => requestBoardData('/api/column-agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agent) })}
    persistence={{
    save: task => requestBoardData('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) }),
    delete: id => requestBoardData(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
}
