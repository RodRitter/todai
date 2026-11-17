"use client";

import { WorkspaceLink as Link } from "@/components/workspace-selection";
import { useState, type ReactNode } from "react";
import { BookOpen, Bot, LayoutGrid, PanelLeft, Settings } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/workspace-selection";
import { Button } from "@/components/ui/button";

export function AppShell({
  children,
  headerActions,
  screen = "board",
}: {
  children: ReactNode;
  headerActions?: ReactNode;
  screen?: "board" | "agents" | "skills" | "settings";
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-svh">
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`shrink-0 overflow-hidden transition-[width] duration-250 ease-in-out motion-reduce:transition-none ${sidebarOpen ? "w-16 md:w-60" : "w-0"}`}
      >
        <div
          className={`h-full w-16 border-r bg-muted/40 transition-[transform,opacity] duration-250 ease-in-out motion-reduce:transition-none md:w-60 ${sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
        >
          <div className="flex h-14 items-center justify-center border-b px-4 md:justify-start">
            <span className="font-semibold md:hidden" aria-label="Todai">
              T
            </span>
            <span className="hidden font-semibold md:inline">Todai</span>
          </div>
          <WorkspaceSwitcher />
          <nav className="p-3" aria-label="Main navigation">
            <Button
              variant={screen === "board" ? "secondary" : "ghost"}
              className="w-full md:justify-start"
              asChild
            >
              <Link
                href="/"
                aria-current={screen === "board" ? "page" : undefined}
                aria-label="Task board"
              >
                <LayoutGrid />
                <span className="hidden md:inline">Board</span>
              </Link>
            </Button>
            <Button
              variant={screen === "agents" ? "secondary" : "ghost"}
              className="mt-1 w-full md:justify-start"
              asChild
            >
              <Link
                href="/agents"
                aria-current={screen === "agents" ? "page" : undefined}
                aria-label="Agents"
              >
                <Bot />
                <span className="hidden md:inline">Agents</span>
              </Link>
            </Button>
            <Button
              variant={screen === "skills" ? "secondary" : "ghost"}
              className="mt-1 w-full md:justify-start"
              asChild
            >
              <Link href="/skills" aria-current={screen === "skills" ? "page" : undefined} aria-label="Skills">
                <BookOpen />
                <span className="hidden md:inline">Skills</span>
              </Link>
            </Button>
            <Button
              variant={screen === "settings" ? "secondary" : "ghost"}
              className="mt-1 w-full md:justify-start"
              asChild
            >
              <Link
                href="/settings"
                aria-current={screen === "settings" ? "page" : undefined}
                aria-label="Settings"
              >
                <Settings />
                <span className="hidden md:inline">Settings</span>
              </Link>
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
          <h1 className="text-sm font-medium">
            {screen === "settings"
              ? "Settings"
              : screen === "agents"
                ? "Agents"
                : screen === "skills"
                  ? "Skills"
                  : "Task board"}
          </h1>
          <div className="ml-auto">{headerActions}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
