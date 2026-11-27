"use client";

import { useEffect, useRef, useState } from "react";
import type { Board } from "@/domain/task";
import { boardApi } from "@/lib/workspace-api";
import { selectedBoardId, selectedWorkspaceId } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { notifyOperation, toast } from "@/components/ui/toast";
import { NavigationTree, NavigationTreeRow } from "@/components/ui/navigation-tree";

export function boardHref(id: string, settings = false) {
  const params = new URLSearchParams({ board: id });
  const workspace = selectedWorkspaceId();
  if (workspace) params.set("workspace", workspace);
  if (settings) params.set("tab", "board");
  return `${settings ? "/settings" : "/"}?${params}`;
}

export function BoardNavigation({ active, initialBoards, reorder = boardApi.reorder }: { active: boolean; initialBoards?: Board[]; reorder?: typeof boardApi.reorder }) {
  const [boards, setBoards] = useState(initialBoards ?? []);
  const pending = useRef(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (initialBoards || !selectedWorkspaceId()) return;
    let live = true;
    boardApi.list().then((boards) => { if (live) { setBoards(boards); setFailed(false); } }).catch(() => { if (live) { setFailed(true); toast.error("Could not load boards."); } });
    return () => { live = false; };
  }, [initialBoards, attempt]);
  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener("todai:boards-changed", refresh);
    return () => window.removeEventListener("todai:boards-changed", refresh);
  }, []);
  async function move(index: number, destination: number) {
    if (pending.current || index === destination || destination < 0 || destination >= boards.length) return;
    const ordered = [...boards];
    const [board] = ordered.splice(index, 1);
    ordered.splice(destination, 0, board);
    pending.current = true;
    setSaving(true);
    try {
      const saved = await notifyOperation(() => reorder(ordered.map((board) => board.id)), {
        loading: "Saving board order…", success: "Board order saved.", error: "Could not save board order. Try again.",
      });
      setBoards(saved);
      window.dispatchEvent(new Event("todai:boards-changed"));
    } catch { /* The notification shows the failure. Keep the saved order. */ }
    finally { setSaving(false); pending.current = false; }
  }
  return <NavigationTree label="Boards" compactOnMobile>
        {boards.map((board, index) => {
          const current = active && board.id === (selectedBoardId() ?? selectedWorkspaceId() ?? boards[0]?.id);
          return <NavigationTreeRow key={board.id} dragging={dragged === board.id} insertion={target === index ? "before" : index === boards.length - 1 && target === boards.length ? "after" : undefined}
            onDragOver={(event) => {
              if (!dragged || saving) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const bounds = event.currentTarget.getBoundingClientRect();
              const insertion = index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0);
              const source = boards.findIndex((item) => item.id === dragged);
              setTarget(insertion === source || insertion === source + 1 ? null : insertion);
            }}
            onDragLeave={() => setTarget(null)}
            onDrop={(event) => {
              event.preventDefault();
              const source = boards.findIndex((item) => item.id === dragged);
              const bounds = event.currentTarget.getBoundingClientRect();
              const insertion = index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0);
              if (source !== -1) void move(source, insertion > source ? insertion - 1 : insertion);
              setDragged(null); setTarget(null);
            }}>
          <Button className="min-w-0 flex-1" variant={current ? "secondary" : "ghost"} align="navigation" size="sm" asChild>
            <a href={boardHref(board.id)} aria-current={current ? "page" : undefined} aria-label={board.name}
              title={boards.length > 1 ? `${board.name}. Drag to reorder. Use Up or Down arrow keys to move.` : board.name}
              draggable={boards.length > 1 && !saving}
              onDragStart={(event) => {
                if (pending.current || boards.length < 2) { event.preventDefault(); return; }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", board.id);
                setDragged(board.id);
              }}
              onDragEnd={() => { setDragged(null); setTarget(null); }}
              onKeyDown={(event) => {
                if (boards.length < 2 || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                event.preventDefault();
                void move(index, index + (event.key === "ArrowUp" ? -1 : 1));
              }}>
              <span className="md:hidden">{index + 1}</span>
              <span className="hidden truncate md:inline">{board.name}</span>
            </a>
          </Button>
          </NavigationTreeRow>;
        })}
        {failed && <Button size="sm" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>Retry boards</Button>}
  </NavigationTree>;
}
