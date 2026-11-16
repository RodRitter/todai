"use client";

import { useEffect, useState } from 'react';
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
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    requestTasks('/api/tasks').then(value => { if (active) setTasks(value); })
      .catch(() => { if (active) setError('Could not load tasks. Check local database access and reload.'); });
    return () => { active = false; };
  }, []);
  if (error) return <main className="p-8"><p role="alert">{error}</p></main>;
  if (!tasks) return <main className="p-8" role="status">Loading tasks…</main>;
  return <TaskBoard initialTasks={tasks} persistence={{
    save: task => requestTasks('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) }),
    delete: id => requestTasks(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
}
