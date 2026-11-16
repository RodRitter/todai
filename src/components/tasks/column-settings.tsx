"use client";

import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ColumnSettings({ initialColumns, create, reorder }: {
  initialColumns: string[];
  create: (name: string) => Promise<string[]>;
  reorder: (columns: string[]) => Promise<string[]>;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(operation: () => Promise<string[]>, success: string, created = false) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setColumns(await operation());
      if (created) setName('');
      setMessage(success);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save columns. Try again.'); }
    finally { saving.current = false; setBusy(false); }
  }

  function addColumn(event: FormEvent) {
    event.preventDefault();
    void save(() => create(name), 'Column created.', true);
  }

  function move(index: number, direction: number) {
    const next = [...columns];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    void save(() => reorder(next), 'Column order saved.');
  }

  return <AppShell screen="settings">
    <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
      <section className="space-y-4" aria-labelledby="columns-heading">
        <div>
          <h2 id="columns-heading" className="text-lg font-semibold">Board columns</h2>
          <p className="text-sm text-muted-foreground">Create columns and choose their order on the board. Changes save automatically.</p>
        </div>
        <ol className="divide-y rounded-lg border" aria-label="Column order" aria-busy={busy}>
          {columns.map((column, index) => <li key={column} className="flex items-center gap-3 p-3">
            <span className="text-sm tabular-nums text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1 break-words font-medium">{column}</span>
            <Button variant="ghost" size="icon" disabled={busy || index === 0} aria-label={`Move ${column} up`} onClick={() => move(index, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={busy || index === columns.length - 1} aria-label={`Move ${column} down`} onClick={() => move(index, 1)}><ArrowDown /></Button>
          </li>)}
        </ol>
        <form onSubmit={addColumn} className="space-y-2">
          <Label htmlFor="column-name">New column name</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="column-name" value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={busy} className="min-w-40 flex-1" placeholder="e.g. Planning" />
            <Button type="submit" disabled={busy || !name.trim()}><Plus /> Add column</Button>
          </div>
        </form>
        <p role="status" className="text-sm text-muted-foreground">{message}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
    </main>
  </AppShell>;
}
