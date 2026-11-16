"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
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
import { AppShell } from "@/components/app-shell";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ColumnSettings({
  initialColumns,
  initialTaskCounts = {},
  create,
  reorder,
  rename,
  remove,
  workspaceSettings,
  tab,
  onTabChange,
}: {
  tab?: "general" | "board";
  onTabChange?: (value: string) => void;
  workspaceSettings?: ReactNode;
  initialColumns: string[];
  initialTaskCounts?: Record<string, number>;
  create: (name: string) => Promise<string[]>;
  reorder: (columns: string[]) => Promise<string[]>;
  rename: (column: string, name: string) => Promise<string[]>;
  remove: (column: string) => Promise<string[]>;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [taskCounts, setTaskCounts] = useState(initialTaskCounts);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  async function save(
    operation: () => Promise<string[]>,
    success: string,
    created = false,
  ) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      setColumns(
        await notifyOperation(operation, {
          loading: "Saving columns…",
          success,
          error: (error) =>
            error instanceof Error
              ? error.message
              : "Could not save columns. Try again.",
        }),
      );
      if (created) setName("");
      setEditing(null);
    } catch {
      /* Keep the draft and saved order; notifyOperation reports the failure. */
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function addColumn(event: FormEvent) {
    event.preventDefault();
    void save(() => create(name), "Column created.", true);
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

  return (
    <AppShell screen="settings">
      <Tabs defaultValue="general" value={tab} onValueChange={onTabChange} asChild>
        <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
          </TabsList>
          <TabsContent value="general" forceMount className="space-y-8">
            {workspaceSettings}
          </TabsContent>
          <TabsContent value="board" forceMount>
            <section className="space-y-4" aria-labelledby="columns-heading">
              <div>
                <h2 id="columns-heading" className="text-lg font-semibold">
                  Board columns
                </h2>
                <p className="text-sm text-muted-foreground">
                  Drag columns to the divider line to reorder them, or use the
                  arrows. Changes save automatically.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Move tasks out of a column before deleting it.
                </p>
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
                        className={`group relative flex items-center gap-3 p-3 transition-colors ${busy || editing !== null ? "" : "cursor-grab active:cursor-grabbing"} ${draggedColumn === column ? "opacity-40" : ""}`}
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
                        {editing === column ? (
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
                        <span
                          aria-label={`${count} ${count === 1 ? "task" : "tasks"}`}
                          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground tabular-nums"
                        >
                          {count}
                        </span>
                        {editing === null && (
                          <div className="flex gap-0.5 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground group-focus-within:text-muted-foreground">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 disabled:opacity-25"
                              disabled={busy || index === 0}
                              aria-label={`Move ${column} up`}
                              onClick={() => move(index, index - 1)}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 disabled:opacity-25"
                              disabled={busy || index === columns.length - 1}
                              aria-label={`Move ${column} down`}
                              onClick={() => move(index, index + 1)}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={busy}
                              aria-label={`Rename ${column}`}
                              onClick={() => {
                                setEditing(column);
                                setDraft(column);
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
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 hover:text-destructive"
                                    disabled={busy || !!deleteReason}
                                    aria-label={`Delete ${column}`}
                                    onClick={() => {
                                      if (!deleteReason)
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
                <Label htmlFor="column-name">New column name</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="column-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={80}
                    disabled={busy || editing !== null}
                    className="min-w-40 flex-1"
                    placeholder="e.g. Planning"
                  />
                  <Button
                    type="submit"
                    disabled={busy || editing !== null || !name.trim()}
                  >
                    <Plus /> Add column
                  </Button>
                </div>
              </form>
            </section>
          </TabsContent>
        </main>
      </Tabs>
      <DeleteConfirmation
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title="Delete column?"
        description={`Delete “${pendingDelete ?? ""}”? Its agent assignment will be removed. This cannot be undone.`}
        busy={busy}
        onConfirm={() => {
          if (pendingDelete !== null) void save(async () => {
            const next = await remove(pendingDelete);
            setPendingDelete(null);
            return next;
          }, "Column deleted.");
        }}
      />
    </AppShell>
  );
}
