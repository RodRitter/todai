"use client";

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { AgentLibrary } from './agent-library';
import { TaskBoard } from './task-board';
import type { AgentProfile, ColumnAssignment } from './column-agent';
import type { Task } from './task';

async function requestBoardData(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error ?? 'Could not save changes. Try again.');
  }
  return response.status === 204 ? undefined : response.json();
}

export function PersistentWorkspace({ screen = "board" }: { screen?: "board" | "agents" }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [agents, setAgents] = useState<AgentProfile[] | null>(null);
  const [assignments, setAssignments] = useState<ColumnAssignment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading('Loading workspace…');
    Promise.all([requestBoardData('/api/tasks'), requestBoardData('/api/agents'), requestBoardData('/api/column-agents')]).then(([tasks, agents, assignments]) => {
      if (active) { setTasks(tasks); setAgents(agents); setAssignments(assignments); toast.dismiss(id); }
    }).catch(() => {
      if (active) {
        setFailed(true);
        toast.error('Could not load the board. Check local database access and try again.', { id, duration: Infinity });
      }
    });
    return () => { active = false; toast.dismiss(id); };
  }, [attempt]);
  if (!tasks || !agents || !assignments) return <main className="p-8" aria-busy={!failed}>
    {failed && <Button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry loading workspace</Button>}
  </main>;
  if (screen === 'agents') return <AgentLibrary initialAgents={agents} initialAssignments={assignments} persistence={{
    save: agent => requestBoardData('/api/agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agent) }),
    delete: id => requestBoardData(`/api/agents?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
  return <TaskBoard initialTasks={tasks} initialAgents={agents} initialAssignments={assignments}
    assignAgent={(column, agentId) => requestBoardData('/api/column-agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column, agentId }) })}
    persistence={{
    save: task => requestBoardData('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) }),
    delete: id => requestBoardData(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
}
