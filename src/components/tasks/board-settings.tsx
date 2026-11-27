"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, LayoutGrid, Plus } from "lucide-react";
import type { Board } from "@/domain/task";
import { boardApi, boardSettingsApi, type BoardSnapshot } from "@/lib/workspace-api";
import { BreadcrumbRow, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { selectedWorkspaceId } from "@/lib/workspace-fetch";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { ColumnEditor } from "./column-editor";

export function BoardSettings({ boards: initialBoards, persistence = boardApi, columnsForBoard = boardSettingsApi }: {
  boards: Board[];
  persistence?: typeof boardApi;
  columnsForBoard?: typeof boardSettingsApi;
}) {
  const [boards, setBoards] = useState(initialBoards);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = boards.find((board) => board.id === selectedId);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  function select(board?: Board) {
    setSelectedId(board?.id ?? null);
    setName(board?.name ?? "");
    setError("");
  }
  async function save(operation: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError("");
    try {
      await operation();
      window.dispatchEvent(new Event("todai:boards-changed"));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save board."); }
    finally { setBusy(false); saving.current = false; }
  }
  return <section className="space-y-6" aria-label="Board settings">
    <BreadcrumbRow actions={!selected && <Button size="sm" onClick={() => { setError(""); setNewName(""); setCreating(true); }}><Plus />New</Button>}>
      <Breadcrumb aria-label="Board breadcrumbs" className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>{selected
            ? <BreadcrumbLink asChild><button type="button" disabled={busy} onClick={() => select()}>All boards</button></BreadcrumbLink>
            : <BreadcrumbPage>All boards</BreadcrumbPage>}
          </BreadcrumbItem>
          {selected && <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{selected.name}</BreadcrumbPage></BreadcrumbItem>
          </>}
        </BreadcrumbList>
      </Breadcrumb>
    </BreadcrumbRow>
    {selected ? <>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        void save(async () => {
          const renamed = await persistence.rename(selected.id, name);
          setBoards((current) => current.map((board) => board.id === renamed.id ? renamed : board));
          setName(renamed.name);
        });
      }}>
        <Label htmlFor="board-name">Board name</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="board-name" className="min-w-0 flex-1" maxLength={80} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
          <Button variant="outline" disabled={busy || !name.trim() || name.trim() === selected.name}>Rename</Button>
          <Button type="button" variant="ghost-destructive" disabled={busy || selected.id === (selectedWorkspaceId() ?? initialBoards[0]?.id)} title={selected.id === (selectedWorkspaceId() ?? initialBoards[0]?.id) ? "The original board is kept as the default board." : undefined} onClick={() => setDeleting(true)}>Delete board</Button>
        </div>
      </form>
      {error && !deleting && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <BoardColumns key={selected.id} boardId={selected.id} persistence={columnsForBoard} disabled={busy} onColumnsChange={(columns) => setBoards((current) => current.map((board) => board.id === selected.id ? { ...board, columns } : board))} />
      <DeleteConfirmation open={deleting} onOpenChange={setDeleting} busy={busy} error={error} title={`Delete ${selected.name}?`} description="Move all tasks out of this board first. Its columns and agent assignments will be removed; shared agents will remain." onConfirm={() => void save(async () => {
        await persistence.remove(selected.id);
        setBoards((current) => current.filter((board) => board.id !== selected.id));
        setDeleting(false);
        select();
      })} />
    </> : <>
      <Card variant="flush" elevation="flat">
        <ul className="divide-y" aria-label="Boards">
          {boards.map((board) => <li key={board.id}>
            <Button variant="ghost" size="row" onClick={() => select(board)}>
              <LayoutGrid />
              <span className="min-w-0 flex-1 break-words">{board.name}</span>
              <ChevronRight />
            </Button>
          </li>)}
        </ul>
      </Card>
    </>}
    <Dialog open={creating} onOpenChange={(open) => { if (!busy) setCreating(open); }}>
      <DialogContent closeDisabled={busy} aria-describedby={undefined}>
        <DialogHeader><DialogTitle>New board</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void save(async () => {
            const board = await persistence.create(newName);
            setBoards((current) => [...current, board]);
            setCreating(false);
            select(board);
          });
        }}>
          <div className="space-y-2"><Label htmlFor="new-board-name">Board name</Label>
            <Input id="new-board-name" autoFocus maxLength={80} disabled={busy} value={newName} onChange={(event) => setNewName(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "new-board-error" : undefined} />
          </div>
          {error && <p id="new-board-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cancel</Button><Button size="sm" disabled={busy || !newName.trim()}>{busy ? "Creating…" : "Create board"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}

function BoardColumns({ boardId, persistence, disabled, onColumnsChange }: {
  boardId: string;
  persistence: typeof boardSettingsApi;
  disabled: boolean;
  onColumnsChange: (columns: string[]) => void;
}) {
  const api = useMemo(() => persistence(boardId), [persistence, boardId]);
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.load().then((result) => { if (active) setSnapshot(result); }).catch(() => { if (active) { setFailed(true); toast.error("Could not load board columns. Try again."); } });
    return () => { active = false; };
  }, [api, attempt]);
  if (!snapshot) return <div aria-busy={!failed} className="space-y-2">
    {!failed && <p className="text-sm text-muted-foreground">Loading columns…</p>}
    {failed && <Button variant="outline" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Retry</Button>}
  </div>;
  async function update(operation: () => Promise<string[]>) {
    const columns = await operation();
    onColumnsChange(columns);
    return columns;
  }
  return <ColumnEditor initialCompletionColumn={snapshot.completionColumn} initialInstructions={snapshot.columnInstructions} configure={(column, name, instructions, completion) => update(() => api.rename(column, name, instructions, completion))} initialColumns={snapshot.columns} initialTaskCounts={Object.fromEntries(snapshot.columns.map((column) => [column, snapshot.tasks.filter((task) => task.status === column).length]))}
    disabled={disabled} create={(name) => update(() => api.create(name))} rename={(column, name) => update(() => api.rename(column, name))}
    remove={(column) => update(() => api.remove(column))} reorder={(columns) => update(() => api.reorder(columns))} />;
}
