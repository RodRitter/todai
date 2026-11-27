"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Upload } from "lucide-react";
import type { Board } from "@/domain/task";
import { boardApi, boardSettingsApi, type BoardSnapshot } from "@/lib/workspace-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectedBoardId, selectedWorkspaceId } from "@/lib/workspace-fetch";
import { notifyOperation, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EditableSetting } from "@/components/ui/editable-setting";
import { Input } from "@/components/ui/input";
import { SettingField } from "@/components/ui/setting-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfigurationTransfer } from "./configuration-transfer";
import { ColumnEditor } from "./column-editor";

export function BoardSettings({ boards: initialBoards, initialBoardId, persistence = boardApi, columnsForBoard = boardSettingsApi }: {
  boards: Board[];
  initialBoardId?: string;
  persistence?: typeof boardApi;
  columnsForBoard?: typeof boardSettingsApi;
}) {
  const [importRevision, setImportRevision] = useState(0);
  const [boards, setBoards] = useState(initialBoards);
  const requestedBoard = initialBoardId ?? (typeof window === "undefined" ? undefined : new URL(window.location.href).searchParams.get("settingsBoard")) ?? selectedBoardId();
  const initialBoard = initialBoards.find((board) => board.id === requestedBoard);
  const [selectedId, setSelectedId] = useState<string | null>(initialBoard?.id ?? initialBoards[0]?.id ?? null);
  const selected = boards.find((board) => board.id === selectedId);
  const [newDescription, setNewDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [editingColumns, setEditingColumns] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  function select(board?: Board) {
    setSelectedId(board?.id ?? null);
    setEditingColumns(false);
    setError("");
    if (selectedWorkspaceId()) {
      const url = new URL(window.location.href);
      if (board) url.searchParams.set("settingsBoard", board.id);
      else url.searchParams.delete("settingsBoard");
      window.history.replaceState(null, "", url);
    }
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
    <div className="flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <SettingField htmlFor="settings-board" label="Board">
          <Select value={selectedId ?? ""} disabled={busy || editingColumns || !boards.length}
            onValueChange={id => select(boards.find(board => board.id === id))}>
            <SelectTrigger id="settings-board" className="w-full"><SelectValue placeholder="No boards" /></SelectTrigger>
            <SelectContent>{boards.map(board => <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>)}</SelectContent>
          </Select>
        </SettingField>
      </div>
      <ConfigurationTransfer scope="import" boardId={selectedId ?? undefined} disabled={busy || editingColumns}
        onImported={() => { setImportRevision(value => value + 1); void persistence.list().then(next => { setBoards(next); setSelectedId(current => next.some(board => board.id === current) ? current : next[0]?.id ?? null); }).catch(() => toast.error("Could not load boards. Reload the page.")); }}
        importTrigger={(open, importing) => <div role="group" aria-label="New board actions" className="flex">
          <Button segment="start" disabled={importing} onClick={() => { setError(""); setNewName(""); setNewDescription(""); setCreating(true); }}><Plus />New board</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button segment="end" size="icon" disabled={importing} aria-label="More board actions"><ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { requestAnimationFrame(open); }}><Upload aria-hidden="true" />Import configuration</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>} />
    </div>
    {selected && <div key={selected.id} className="space-y-6">
      <div className="space-y-4">
        <SettingField htmlFor="board-name" label="Board name"><EditableSetting id="board-name" label="Board name" value={selected.name} maxLength={80} disabled={busy}
            onSave={value => updateBoard(value, selected.description ?? "Organize and track tasks on this board.")} />
        </SettingField>
        <SettingField htmlFor="board-description" label="Description"><EditableSetting id="board-description" label="Description" multiline value={selected.description ?? "Organize and track tasks on this board."} maxLength={500} disabled={busy}
            onSave={value => updateBoard(selected.name, value)} />
        </SettingField>
      </div>
      <BoardColumns key={`${selected.id}:${importRevision}`} boardId={selected.id} persistence={columnsForBoard} disabled={busy} onBusyChange={setBusy} onEditingChange={setEditingColumns} onColumnsChange={(columns) => setBoards((current) => current.map((board) => board.id === selected.id ? { ...board, columns } : board))} />
      <div className="flex flex-wrap items-center gap-2">
        <ConfigurationTransfer scope="board" boardId={selected.id} disabled={busy || editingColumns} onImported={() => {}} />
        <Button type="button" variant="ghost-destructive" disabled={busy || editingColumns || selected.id === (selectedWorkspaceId() ?? initialBoards[0]?.id)} onClick={() => setDeleting(true)}>Delete board</Button>
      </div>
      <DeleteConfirmation open={deleting} onOpenChange={setDeleting} busy={busy} title={`Delete ${selected.name}?`} description="Move all tasks out of this board first. Its columns and agent assignments will be removed; shared agents will remain." onConfirm={() => void save(async () => {
        await persistence.remove(selected.id);
        setBoards((current) => current.filter((board) => board.id !== selected.id));
        setDeleting(false);
        select(boards.find(board => board.id !== selected.id));
      })} />
    </div>}
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
          <SettingField htmlFor="new-board-name" label="Board name"><Input id="new-board-name" autoFocus maxLength={80} disabled={busy} value={newName} onChange={(event) => setNewName(event.target.value)} aria-invalid={!!error} />
          </SettingField>
          <SettingField htmlFor="new-board-description" label="Description"><Textarea id="new-board-description" required maxLength={500} disabled={busy} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
          </SettingField>
          <DialogFooter><Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cancel</Button><Button size="sm" disabled={busy || !newName.trim() || !newDescription.trim()}>{busy ? "Creating…" : "Create board"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}

function BoardColumns({ boardId, persistence, disabled, onColumnsChange, onBusyChange, onEditingChange }: {
  boardId: string;
  persistence: typeof boardSettingsApi;
  disabled: boolean;
  onColumnsChange: (columns: string[]) => void;
  onBusyChange: (busy: boolean) => void;
  onEditingChange: (editing: boolean) => void;
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
    onBusyChange(true);
    try {
      const columns = await operation();
      onColumnsChange(columns);
      return columns;
    } finally { onBusyChange(false); }
  }
  return <ColumnEditor onEditingChange={onEditingChange} initialCompletionColumn={snapshot.completionColumn} initialInstructions={snapshot.columnInstructions} configure={(column, name, instructions, completion) => update(() => api.rename(column, name, instructions, completion))} initialColumns={snapshot.columns} initialTaskCounts={Object.fromEntries(snapshot.columns.map((column) => [column, snapshot.tasks.filter((task) => task.status === column).length]))}
    disabled={disabled} create={(name) => update(() => api.create(name))} rename={(column, name) => update(() => api.rename(column, name))}
    remove={(column) => update(() => api.remove(column))} reorder={(columns) => update(() => api.reorder(columns))} />;
}
