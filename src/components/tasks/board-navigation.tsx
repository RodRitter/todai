"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, LayoutGrid } from "lucide-react";
import type { Board } from "@/domain/task";
import { boardApi } from "@/lib/workspace-api";
import { selectedBoardId, selectedWorkspaceId } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function boardHref(id: string, settings = false) {
  const params = new URLSearchParams({ board: id });
  const workspace = selectedWorkspaceId();
  if (workspace) params.set("workspace", workspace);
  if (settings) params.set("tab", "board");
  return `${settings ? "/settings" : "/"}?${params}`;
}

export function BoardNavigation({ active, initialBoards }: { active: boolean; initialBoards?: Board[] }) {
  const [boards, setBoards] = useState(initialBoards ?? []);
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (initialBoards || !selectedWorkspaceId()) return;
    let live = true;
    boardApi.list().then((boards) => { if (live) { setBoards(boards); setFailed(false); } }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [initialBoards, attempt]);
  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener("todai:boards-changed", refresh);
    return () => window.removeEventListener("todai:boards-changed", refresh);
  }, []);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" align="navigation" aria-label="Boards">
        <FolderOpen /><span className="hidden min-w-0 flex-1 text-left md:inline">Boards</span>
        <span className="hidden md:inline">{open ? <ChevronDown /> : <ChevronRight />}</span>
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="space-y-1 border-l border-border md:ml-4 md:pl-2">
        {boards.map((board, index) => {
          const current = active && board.id === (selectedBoardId() ?? boards[0]?.id);
          return <Button key={board.id} variant={current ? "secondary" : "ghost"} align="navigation" size="sm" asChild>
            <a href={boardHref(board.id)} aria-current={current ? "page" : undefined} aria-label={board.name} title={board.name}>
              <LayoutGrid className="hidden md:block" /><span className="md:hidden">{index + 1}</span>
              <span className="hidden truncate md:inline">{board.name}</span>
            </a>
          </Button>;
        })}
        {failed && <Button size="sm" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>Retry boards</Button>}
      </div>
    </CollapsibleContent>
  </Collapsible>;
}
