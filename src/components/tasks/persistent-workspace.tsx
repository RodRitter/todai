"use client";

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { ColumnSettings } from './column-settings';
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

export function PersistentWorkspace({ screen = "board" }: { screen?: "board" | "agents" | "settings" }) {
  const [columns, setColumns] = useState<string[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [agents, setAgents] = useState<AgentProfile[] | null>(null);
  const [assignments, setAssignments] = useState<ColumnAssignment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const id = toast.loading('Loading workspace…');
    Promise.all([requestBoardData('/api/tasks?workspace=true'), requestBoardData('/api/agents')]).then(([{ tasks, assignments, columns }, agents]) => {
      if (active) { setColumns(columns); setTasks(tasks); setAgents(agents); setAssignments(assignments); toast.dismiss(id); }
    }).catch(() => {
      if (active) {
        setFailed(true);
        toast.error('Could not load the board. Check local database access and try again.', { id, duration: Infinity });
      }
    });
    return () => { active = false; toast.dismiss(id); };
  }, [attempt]);
  if (!columns || !tasks || !agents || !assignments) return <main className="p-8" aria-busy={!failed}>
    {failed && <Button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry loading workspace</Button>}
  </main>;
  if (screen === 'settings') return <ColumnSettings initialColumns={columns}
    create={name => requestBoardData('/api/columns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(name) })}
    rename={(column, name) => requestBoardData('/api/columns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column, name }) })}
    remove={column => requestBoardData('/api/columns', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(column) })}
    reorder={columns => requestBoardData('/api/columns', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(columns) })}
  />;
  if (screen === 'agents') return <AgentLibrary initialAgents={agents} initialAssignments={assignments} persistence={{
    save: agent => requestBoardData('/api/agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agent) }),
    delete: id => requestBoardData(`/api/agents?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
  return <TaskBoard columns={columns} initialTasks={tasks} initialAgents={agents} initialAssignments={assignments}
    assignAgent={(column, agentId) => requestBoardData('/api/column-agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column, agentId }) })}
    persistence={{
    list: () => requestBoardData('/api/tasks?workspace=true'),
    save: task => requestBoardData('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) }),
    delete: id => requestBoardData(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }} />;
}
