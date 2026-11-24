"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type DragEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyOperation } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnSettingsDialog } from "./column-settings-dialog";
import { Label } from "@/components/ui/label";

export type ColumnEditorProps = {
  initialColumns: string[];
  initialInstructions?: Record<string, string>;
  initialCompletionColumn?: string | null;
  configure?: (column: string, name: string, instructions: string, completion: boolean) => Promise<string[]>;
  initialTaskCounts?: Record<string, number>;
  create: (name: string) => Promise<string[]>;
  reorder: (columns: string[]) => Promise<string[]>;
  rename: (column: string, name: string) => Promise<string[]>;
  remove: (column: string) => Promise<string[]>;
  compact?: boolean;
  disabled?: boolean;
  onEditingChange?: (editing: boolean) => void;
};

export function ColumnEditor({ initialInstructions = {}, initialCompletionColumn = null, configure, initialColumns, initialTaskCounts = {}, create, reorder, rename, remove, compact = false, disabled = false, onEditingChange }: ColumnEditorProps) {
  const [completionColumn, setCompletionColumn] = useState(initialCompletionColumn);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [columns, setColumns] = useState(initialColumns);
  const [taskCounts, setTaskCounts] = useState(initialTaskCounts);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pending, setBusy] = useState(false);
  const busy = pending || disabled;
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => { onEditingChange?.(editing !== null || !!name.trim()); }, [editing, name, onEditingChange]);
  const saving = useRef(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  async function save(
    operation: () => Promise<string[]>,
    success: string,
    created = false,
  ) {
    if (saving.current || disabled) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      setColumns(
        await (compact ? operation() : notifyOperation(operation, {
          loading: "Saving columns…",
          success,
          error: (error) =>
            error instanceof Error
              ? error.message
              : "Could not save columns. Try again.",
        })),
      );
      if (created) setName("");
      setEditing(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update columns.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function addColumn(event: FormEvent) {
    event.preventDefault();
    void save(async () => {
      const next = await create(name);
      const created = next.find((column) => !columns.includes(column));
      if (created) {
        setInstructions((current) => ({ ...current, [created]: "" }));
      }
      return next;
    }, "Column created.", true);
  }

  function move(index: number, destination: number) {
    if (index === destination || saving.current) return;
    const next = [...columns];
    const [column] = next.splice(index, 1);
    next.splice(destination, 0, column);
    void save(() => reorder(next), "Column order saved.");
  }

  function insertionIndex(event: DragEvent<HTMLLIElement>, index: number) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0);
  }

  function endDrag() {
    setDraggedColumn(null);
    setDropIndex(null);
  }

  return <>
            <section className="space-y-4" aria-labelledby={`${id}-heading`}>
              <div>
                <h2 id={`${id}-heading`} className={compact ? "text-sm font-semibold" : "text-lg font-semibold"}>
                  Board columns
                </h2>
                {!compact && <><p className="text-sm text-muted-foreground">
                  Drag columns to the divider line to reorder them, or use the
                  arrows. Select the edit button to change column settings.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Move tasks out of a column before deleting it.
                </p></>}
              </div>
              <TooltipProvider>
                <ol
                  className="divide-y rounded-lg border"
                  aria-label="Column order"
                  aria-busy={busy}
                >
                  {columns.map((column, index) => {
                    const count = taskCounts[column] ?? 0;
                    const deleteReason =
                      count > 0
                        ? "Move all tasks to another column before deleting this column."
                        : columns.length === 1
                          ? "Keep at least one board column."
                          : undefined;
                    return (
                      <li
                        key={column}
                        draggable={!busy && editing === null}
                        className={`group relative flex items-center gap-2 p-2 transition-colors ${busy || editing !== null ? "" : "cursor-grab active:cursor-grabbing"} ${draggedColumn === column ? "opacity-40" : ""}`}
                        onDragStart={(event) => {
                          if (
                            saving.current ||
                            editing !== null ||
                            (event.target as HTMLElement).closest("button, input")
                          ) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", column);
                          setDraggedColumn(column);
                        }}
                        onDragOver={(event) => {
                          if (busy || !draggedColumn) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          const insertion = insertionIndex(event, index);
                          const source = columns.indexOf(draggedColumn);
                          setDropIndex(
                            insertion === source || insertion === source + 1
                              ? null
                              : insertion,
                          );
                        }}
                        onDragLeave={(event) => {
                          if (
                            !(event.relatedTarget instanceof Node) ||
                            !event.currentTarget.contains(event.relatedTarget)
                          )
                            setDropIndex(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!busy && draggedColumn) {
                            const source = columns.indexOf(draggedColumn);
                            const insertion = insertionIndex(event, index);
                            if (source !== -1)
                              move(
                                source,
                                insertion > source ? insertion - 1 : insertion,
                              );
                          }
                          endDrag();
                        }}
                        onDragEnd={endDrag}
                      >
                        {(dropIndex === index ||
                          (index === columns.length - 1 &&
                            dropIndex === columns.length)) && (
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute -inset-x-px z-10 h-0.5 rounded-full bg-primary ${dropIndex === index ? "-top-px" : "-bottom-px"}`}
                          />
                        )}
                        <GripVertical
                          className="size-4 shrink-0 text-muted-foreground/50"
                          aria-hidden="true"
                        />
                        {editing === column && !configure ? (
                          <form
                            className="flex min-w-0 flex-1 flex-wrap gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void save(async () => {
                                const next = await rename(column, draft);
                                const renamed =
                                  next.find((name) => !columns.includes(name)) ??
                                  column;
                                setTaskCounts((counts) => {
                                  const updated = { ...counts };
                                  delete updated[column];
                                  updated[renamed] = count;
                                  return updated;
                                });
                                return next;
                              }, "Column renamed.");
                            }}
                          >
                            <Input
                              aria-label={`New name for ${column}`}
                              autoFocus
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              maxLength={80}
                              required
                              disabled={busy}
                              className="min-w-24 flex-1"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={busy || !draft.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </Button>
                          </form>
                        ) : (
                          <span className="min-w-0 flex-1 break-words font-medium">
                            {column}
                          </span>
                        )}
                        {!compact && <span
                          aria-label={`${count} ${count === 1 ? "task" : "tasks"}`}
                          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground tabular-nums"
                        >
                          {count}
                        </span>}
                        {editing === null && (
                          <div className="flex gap-0.5 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground group-focus-within:text-muted-foreground">
                            <Button
                              variant="ghost"
                              size="icon-xs"

                              disabled={busy || index === 0}
                              aria-label={`Move ${column} up`}
                              onClick={() => move(index, index - 1)}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"

                              disabled={busy || index === columns.length - 1}
                              aria-label={`Move ${column} down`}
                              onClick={() => move(index, index + 1)}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"

                              disabled={busy}
                              aria-label={`${configure ? "Configure" : "Rename"} ${column}`}
                              onClick={() => {
                                setEditing(column);
                                setDraft(column);
                                setError("");
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  tabIndex={deleteReason ? 0 : undefined}
                                  aria-label={
                                    deleteReason
                                      ? `Delete ${column} unavailable`
                                      : undefined
                                  }
                                  className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Button
                                    variant="ghost-destructive"
                                    size="icon-xs"

                                    disabled={busy || !!deleteReason}
                                    aria-label={`Delete ${column}`}
                                    onClick={() => {
                                      if (deleteReason) return;
                                      setPendingDelete(column);
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {deleteReason && (
                                <TooltipContent>{deleteReason}</TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </TooltipProvider>
              <form onSubmit={addColumn} className="space-y-2">
                <Label htmlFor={`${id}-name`} className={compact ? "sr-only" : undefined}>New column name</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id={`${id}-name`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={80}
                    disabled={busy || editing !== null}
                    className="min-w-40 flex-1"
                    placeholder={compact ? "New column" : "e.g. Planning"}
                  />
                  <Button
                    type="submit"
                    disabled={busy || editing !== null || !name.trim()}
                  >
                    <Plus /> Add column
                  </Button>
                </div>
              </form>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </section>
      {configure && editing !== null && <ColumnSettingsDialog column={editing} completion={completionColumn === editing} instructions={instructions[editing] ?? ""} open disabled={disabled}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        onSave={async (name, instructionDraft, completion) => {
          if (saving.current) throw new Error("Wait for the current save to finish.");
          saving.current = true; setBusy(true);
          try {
            const next = await configure(editing, name, instructionDraft, completion);
            setColumns(next);
            setCompletionColumn((current) => completion ? name : current === editing ? null : current);
            setInstructions((current) => ({ ...current, [name]: instructionDraft }));
            setTaskCounts((current) => ({ ...current, [name]: current[editing] ?? 0 }));
          } finally { saving.current = false; setBusy(false); }
        }} />}
      <DeleteConfirmation
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title="Delete column?"
        description={`Delete “${pendingDelete ?? ""}”? Its agent assignment will be removed. This cannot be undone.`}
        busy={busy}
        error={error}
        onConfirm={() => {
          if (pendingDelete !== null) void save(async () => {
            const next = await remove(pendingDelete);
            if (completionColumn === pendingDelete) setCompletionColumn(null);
            setPendingDelete(null);
            return next;
          }, "Column deleted.");
        }}
      />
  </>;
}
