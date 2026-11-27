"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, LayoutGrid, Plus } from "lucide-react";
import type { Board } from "@/domain/task";
import { boardApi, boardSettingsApi, type BoardSnapshot } from "@/lib/workspace-api";
import { BreadcrumbRow, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { selectedWorkspaceId } from "@/lib/workspace-fetch";
import { notifyOperation, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EditableSetting } from "@/components/ui/editable-setting";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { ColumnEditor } from "./column-editor";

export function BoardSettings({ boards: initialBoards, initialBoardId, persistence = boardApi, columnsForBoard = boardSettingsApi }: {
  boards: Board[];
  initialBoardId?: string;
  persistence?: typeof boardApi;
  columnsForBoard?: typeof boardSettingsApi;
}) {
  const [boards, setBoards] = useState(initialBoards);
  const initialBoard = initialBoards.find((board) => board.id === initialBoardId);
  const [selectedId, setSelectedId] = useState<string | null>(initialBoard?.id ?? null);
  const selected = boards.find((board) => board.id === selectedId);
  const [newDescription, setNewDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  function select(board?: Board) {
    setSelectedId(board?.id ?? null);
    setError("");
  }
  async function save(operation: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError("");
    try {
      await notifyOperation(operation, {
        loading: "Saving board…", success: "Board saved.",
        error: (error) => error instanceof Error ? error.message : "Could not save board. Try again.",
      });
      window.dispatchEvent(new Event("todai:boards-changed"));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save board."); }
    finally { setBusy(false); saving.current = false; }
  }
  async function updateBoard(name: string, description: string) {
    if (!selected || saving.current) throw new Error("Wait for the current save to finish.");
    saving.current = true; setBusy(true);
    try {
      const renamed = await persistence.rename(selected.id, name, description);
      setBoards(current => current.map(board => board.id === renamed.id ? renamed : board));
      window.dispatchEvent(new Event("todai:boards-changed"));
    } finally { saving.current = false; setBusy(false); }
  }
  return <section className="space-y-6" aria-label="Board settings">
    <BreadcrumbRow actions={!selected && <Button size="sm" onClick={() => { setError(""); setNewName(""); setNewDescription(""); setCreating(true); }}><Plus />New</Button>}>
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
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="board-name">Board name</Label>
          <EditableSetting id="board-name" label="Board name" value={selected.name} maxLength={80} disabled={busy}
            onSave={value => updateBoard(value, selected.description ?? "Organize and track tasks on this board.")} />
        </div>
        <div className="space-y-2"><Label htmlFor="board-description">Description</Label>
          <EditableSetting id="board-description" label="Description" multiline value={selected.description ?? "Organize and track tasks on this board."} maxLength={500} disabled={busy}
            onSave={value => updateBoard(selected.name, value)} />
        </div>
        <Button type="button" variant="ghost-destructive" disabled={busy || selected.id === (selectedWorkspaceId() ?? initialBoards[0]?.id)} onClick={() => setDeleting(true)}>Delete board</Button>
      </div>
      <BoardColumns key={selected.id} boardId={selected.id} persistence={columnsForBoard} disabled={busy} onColumnsChange={(columns) => setBoards((current) => current.map((board) => board.id === selected.id ? { ...board, columns } : board))} />
      <DeleteConfirmation open={deleting} onOpenChange={setDeleting} busy={busy} title={`Delete ${selected.name}?`} description="Move all tasks out of this board first. Its columns and agent assignments will be removed; shared agents will remain." onConfirm={() => void save(async () => {
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
            const board = await persistence.create(newName, newDescription);
            setBoards((current) => [...current, board]);
            setCreating(false);
            select(board);
          });
        }}>
          <div className="space-y-2"><Label htmlFor="new-board-name">Board name</Label>
            <Input id="new-board-name" autoFocus maxLength={80} disabled={busy} value={newName} onChange={(event) => setNewName(event.target.value)} aria-invalid={!!error} />
          </div>
          <div className="space-y-2"><Label htmlFor="new-board-description">Description</Label>
            <Textarea id="new-board-description" required maxLength={500} disabled={busy} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
          </div>
          <DialogFooter><Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cancel</Button><Button size="sm" disabled={busy || !newName.trim() || !newDescription.trim()}>{busy ? "Creating…" : "Create board"}</Button></DialogFooter>
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
