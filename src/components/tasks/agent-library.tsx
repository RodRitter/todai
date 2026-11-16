"use client";

import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { notifyOperation } from '@/components/ui/toast';
import { AgentEditor } from './agent-editor';
import type { AgentProfile, ColumnAssignment } from './column-agent';

export function AgentLibrary({ initialAgents = [], initialAssignments = [], persistence }: {
  initialAgents?: AgentProfile[];
  initialAssignments?: ColumnAssignment[];
  persistence?: { save: (agent: AgentProfile) => Promise<AgentProfile>; delete: (id: string) => Promise<void> };
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [editing, setEditing] = useState<AgentProfile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);

  async function deleteAgent(agent: AgentProfile) {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    try {
      await notifyOperation(async () => {
        await persistence?.delete(agent.id);
        setAgents(current => current.filter(item => item.id !== agent.id));
        setAssignments(current => current.filter(item => item.agentId !== agent.id));
      }, {
        loading: 'Deleting agent…', success: 'Agent deleted and removed from its columns.',
        error: 'Could not delete agent. Try again or reload to check.',
      });
    } catch { /* Keep the saved agent visible on failure. */ }
    finally { deleting.current = false; setBusy(false); }
  }

  return <AppShell screen="agents" headerActions={<Button size="sm" disabled={busy} onClick={() => setEditing(null)}><Plus /> New agent</Button>}>
    <main className="p-4 md:p-8" aria-label="Agents">
      <Card className="max-w-5xl gap-0 overflow-hidden py-0">
      {agents.length ? <ul className="divide-y">
        {agents.map(agent => {
          const columns = assignments.filter(item => item.agentId === agent.id).map(item => item.column);
          return <li key={agent.id}><section aria-label={agent.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
            <h2 className="col-start-1 min-w-0 break-words text-sm font-medium">{agent.name}</h2>
            <p className="col-start-1 min-w-0 break-words text-xs text-muted-foreground md:col-start-auto">{agent.model} · {agent.effort}</p>
            <p className="col-start-1 text-xs text-muted-foreground md:col-start-auto">{columns.length ? columns.join(', ') : 'Unassigned'}</p>
            <div className="col-start-2 row-start-1 row-span-3 flex gap-1 md:col-start-auto md:row-auto md:row-span-1">
              <Button size="sm" variant="ghost" aria-label="Edit agent" disabled={busy} onClick={() => setEditing(agent)}>Edit</Button>
              <Button size="sm" variant="ghost" aria-label="Delete agent" disabled={busy} onClick={() => void deleteAgent(agent)}>Delete</Button>
            </div>
          </section></li>;
        })}
      </ul> : <div className="px-4 py-6 text-sm text-muted-foreground">No agents yet. Create an agent to get started.</div>}
      </Card>
      {editing !== undefined && <AgentEditor agent={editing ?? undefined} onClose={() => setEditing(undefined)} onSave={async agent => {
        const saved = persistence ? await persistence.save(agent) : agent;
        setAgents(current => current.some(item => item.id === saved.id)
          ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
      }} />}
    </main>
  </AppShell>;
}
