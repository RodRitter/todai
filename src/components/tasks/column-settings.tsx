"use client";

import { useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { notifyOperation } from '@/components/ui/toast';
import { Label } from '@/components/ui/label';

export function ColumnSettings({ initialColumns, create, reorder, rename, remove }: {
  initialColumns: string[];
  create: (name: string) => Promise<string[]>;
  reorder: (columns: string[]) => Promise<string[]>;
  rename: (column: string, name: string) => Promise<string[]>;
  remove: (column: string) => Promise<string[]>;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);

  async function save(operation: () => Promise<string[]>, success: string, created = false) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      setColumns(await notifyOperation(operation, {
        loading: 'Saving columns…',
        success,
        error: error => error instanceof Error ? error.message : 'Could not save columns. Try again.',
      }));
      if (created) setName('');
      setEditing(null);
    } catch { /* Keep the draft and saved order; notifyOperation reports the failure. */ }
    finally { saving.current = false; setBusy(false); }
  }

  function addColumn(event: FormEvent) {
    event.preventDefault();
    void save(() => create(name), 'Column created.', true);
  }

  function move(index: number, destination: number) {
    if (index === destination || saving.current) return;
    const next = [...columns];
    const [column] = next.splice(index, 1);
    next.splice(destination, 0, column);
    void save(() => reorder(next), 'Column order saved.');
  }

  function endDrag() {
    setDraggedColumn(null);
    setDropColumn(null);
  }

  return <AppShell screen="settings">
    <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
      <section className="space-y-4" aria-labelledby="columns-heading">
        <div>
          <h2 id="columns-heading" className="text-lg font-semibold">Board columns</h2>
          <p className="text-sm text-muted-foreground">Drag columns to reorder them, or use the arrows. Changes save automatically.</p>
          <p className="mt-1 text-xs text-muted-foreground">Move tasks out of a column before deleting it.</p>
        </div>
        <ol className="divide-y rounded-lg border" aria-label="Column order" aria-busy={busy}>
          {columns.map((column, index) => <li
            key={column}
            draggable={!busy && editing === null}
            className={`group flex items-center gap-3 p-3 transition-colors ${busy || editing !== null ? '' : 'cursor-grab active:cursor-grabbing'} ${draggedColumn === column ? 'opacity-40' : ''} ${dropColumn === column ? 'bg-accent ring-1 ring-inset ring-ring' : ''}`}
            onDragStart={event => {
              if (saving.current || editing !== null || (event.target as HTMLElement).closest('button, input')) { event.preventDefault(); return; }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', column);
              setDraggedColumn(column);
            }}
            onDragOver={event => {
              if (busy || !draggedColumn || draggedColumn === column) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropColumn(column);
            }}
            onDragLeave={event => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropColumn(null);
            }}
            onDrop={event => {
              event.preventDefault();
              if (!busy && draggedColumn) {
                const source = columns.indexOf(draggedColumn);
                if (source !== -1) move(source, index);
              }
              endDrag();
            }}
            onDragEnd={endDrag}
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            {editing === column ? <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={event => {
              event.preventDefault();
              void save(() => rename(column, draft), 'Column renamed.');
            }}>
              <Input aria-label={`New name for ${column}`} autoFocus value={draft} onChange={event => setDraft(event.target.value)} maxLength={80} required disabled={busy} className="min-w-24 flex-1" />
              <Button type="submit" size="sm" disabled={busy || !draft.trim()}>Save</Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
            </form> : <span className="min-w-0 flex-1 break-words font-medium">{column}</span>}
            {editing === null && <div className="flex gap-0.5 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground group-focus-within:text-muted-foreground">
              <Button variant="ghost" size="icon" className="size-7 disabled:opacity-25" disabled={busy || index === 0} aria-label={`Move ${column} up`} onClick={() => move(index, index - 1)}><ChevronUp className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7 disabled:opacity-25" disabled={busy || index === columns.length - 1} aria-label={`Move ${column} down`} onClick={() => move(index, index + 1)}><ChevronDown className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7" disabled={busy} aria-label={`Rename ${column}`} onClick={() => { setEditing(column); setDraft(column); }}><Pencil className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" disabled={busy || columns.length === 1} aria-label={`Delete ${column}`} onClick={() => { void save(() => remove(column), 'Column deleted.'); }}><Trash2 className="size-3.5" /></Button>
            </div>}
          </li>)}
        </ol>
        <form onSubmit={addColumn} className="space-y-2">
          <Label htmlFor="column-name">New column name</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="column-name" value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={busy || editing !== null} className="min-w-40 flex-1" placeholder="e.g. Planning" />
            <Button type="submit" disabled={busy || editing !== null || !name.trim()}><Plus /> Add column</Button>
          </div>
        </form>
      </section>
    </main>
  </AppShell>;
}
