import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Board } from "@/domain/task";

export function BoardHeader({ board, onEdit, disabled }: { board?: Board; onEdit: () => void; disabled?: boolean }) {
  return <header className="mb-4 min-w-0 space-y-1">
    <div className="group flex items-center gap-2">
    <h1 className="break-words text-lg font-semibold">{board?.name ?? "Task board"}</h1>
    {board && <Button variant="ghost-muted" size="icon-xs" reveal="hover" disabled={disabled} onClick={onEdit} aria-label={`Edit ${board.name}`} title="Edit board">
      <Pencil aria-hidden="true" />
    </Button>}
    </div>
    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{board?.description ?? "Organize and track tasks on this board."}</p>
  </header>;
}
