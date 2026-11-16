"use client";

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { notifyOperation } from '@/components/ui/toast';
import { AgentValidationError, effortLevels, parseColumnAgent, type ColumnAgent } from './column-agent';
import type { Status } from './task';

export function ColumnAgentEditor({ column, agent, onClose, onSave }: {
  column: Status;
  agent?: ColumnAgent;
  onClose: () => void;
  onSave: (agent: ColumnAgent) => Promise<void>;
}) {
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AgentValidationError | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const data = new FormData(event.currentTarget);
    let draft: ColumnAgent;
    try {
      draft = parseColumnAgent({ ...Object.fromEntries(data), column, tool: 'codex' });
    } catch (error) {
      setError(error as AgentValidationError);
      return;
    }
    setError(null);
    saving.current = true;
    setBusy(true);
    try {
      await notifyOperation(() => onSave(draft), {
        loading: 'Saving column agent…',
        success: 'Column agent saved.',
        error: 'Could not save column agent. Check local database access and try again. Your draft is still open.',
      });
      onClose();
    } catch { /* Keep the draft available for retry. */ }
    finally { saving.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving.current) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Agent for {column}</DialogTitle>
        <DialogDescription>Configure the agent assigned to this column. Saving settings does not start a run.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} noValidate className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input id="agent-name" name="name" defaultValue={agent?.name ?? `${column} agent`} required
              aria-invalid={error?.field === 'name'} aria-describedby={error?.field === 'name' ? 'agent-name-error' : undefined}
              onChange={() => setError(null)} />
            {error?.field === 'name' && <p id="agent-name-error" role="alert" className="text-sm text-destructive">{error.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-tool">Execution tool</Label>
            <Input id="agent-tool" value="Codex CLI" readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-model">Model</Label>
            <Input id="agent-model" name="model" defaultValue={agent?.model ?? ''} required
              aria-invalid={error?.field === 'model'} aria-describedby={error?.field === 'model' ? 'agent-model-help agent-model-error' : 'agent-model-help'}
              onChange={() => setError(null)} />
            {error?.field === 'model' && <p id="agent-model-error" role="alert" className="text-sm text-destructive">{error.message}</p>}
            <p id="agent-model-help" className="text-sm text-muted-foreground">Enter a model ID available to your Codex CLI account.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-effort">Effort</Label>
            <NativeSelect id="agent-effort" name="effort" defaultValue={agent?.effort ?? 'medium'}>
              {effortLevels.map(effort => <option key={effort}>{effort}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-instructions">Instructions</Label>
            <Textarea id="agent-instructions" name="instructions" defaultValue={agent?.instructions ?? ''} aria-describedby="agent-instructions-help" />
            <p id="agent-instructions-help" className="text-sm text-muted-foreground">Optional instructions in addition to the task description and handovers.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-permissions">Permissions</Label>
            <NativeSelect id="agent-permissions" name="permissions" defaultValue={agent?.permissions ?? 'workspace-write'}>
              <option value="read-only">Read only</option>
              <option value="workspace-write">Write to workspace</option>
              <option value="danger-full-access">Full access (no sandbox)</option>
            </NativeSelect>
          </div>
          {error && !error.field && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit">Save agent</Button>
          </DialogFooter>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>;
}
