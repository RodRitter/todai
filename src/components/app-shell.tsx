"use client";

import { useState, type ReactNode } from "react";
import { LayoutGrid, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children, headerActions }: { children: ReactNode; headerActions?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-svh">
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`shrink-0 overflow-hidden transition-[width] duration-250 ease-in-out motion-reduce:transition-none ${sidebarOpen ? "w-16 md:w-48" : "w-0"}`}
      >
        <div className={`h-full w-16 border-r bg-muted/40 transition-[transform,opacity] duration-250 ease-in-out motion-reduce:transition-none md:w-48 ${sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}>
          <div className="flex h-14 items-center justify-center border-b px-4 md:justify-start">
            <span className="font-semibold md:hidden" aria-label="Todai">T</span>
            <span className="hidden font-semibold md:inline">Todai</span>
          </div>
          <nav className="p-3" aria-label="Main navigation">
            <Button variant="secondary" className="w-full md:justify-start" asChild>
              <a href="#task-board" aria-current="page" aria-label="Task board">
                <LayoutGrid />
                <span className="hidden md:inline">Board</span>
              </a>
            </Button>
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={() => setSidebarOpen((current) => !current)}
          >
            <PanelLeft />
          </Button>
          <h1 className="text-sm font-medium">Task board</h1>
          <div className="ml-auto">{headerActions}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
