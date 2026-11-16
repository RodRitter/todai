"use client";

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { TaskBoard } from './task-board';
import type { Task } from './task';

async function requestTasks(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error ?? 'Could not save changes. Try again.');
  }
  return response.status === 204 ? undefined : response.json();
}

export function PersistentTaskBoard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading('Loading tasks…');
    requestTasks('/api/tasks').then(value => {
      if (active) { setTasks(value); toast.dismiss(id); }
    }).catch(() => {
      if (active) {
        setFailed(true);
        toast.error('Could not load tasks. Check local database access and try again.', { id, duration: Infinity });
      }
    });
    return () => { active = false; toast.dismiss(id); };
  }, [attempt]);
  if (!tasks) return <main className="p-8" aria-busy={!failed}>
    {failed && <Button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry loading tasks</Button>}
  </main>;
  return <TaskBoard initialTasks={tasks} persistence={{
    save: task => requestTasks('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) }),
    delete: id => requestTasks(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
}
