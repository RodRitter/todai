"use client";

import { BoardNavigation } from "./tasks/board-navigation";
import { WorkspaceLink as Link } from "@/components/workspace-selection";
import { useState, type ReactNode } from "react";
import { BookOpen, Bot, Brain, Files, PanelLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/workspace-selection";
import { ExecutionActivity } from "@/components/execution-activity";
import { ServerNotifications } from "@/components/server-notifications";

import { TrackedCredits } from "./tracked-credits";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function AppShell({
  children,
  headerActions,
  boardName,
  screen = "board",
}: {
  children: ReactNode;
  headerActions?: ReactNode;
  boardName?: string;
  screen?: "board" | "agents" | "skills" | "artifacts" | "memory" | "settings";
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
            <BoardNavigation active={screen === "board"} />
            <Button align="navigation"
              variant={screen === "agents" ? "secondary" : "ghost"}
              className="mt-1"
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
            <Button align="navigation"
              variant={screen === "skills" ? "secondary" : "ghost"}
              className="mt-1"
              asChild
            >
              <Link href="/skills" aria-current={screen === "skills" ? "page" : undefined} aria-label="Skills">
                <BookOpen />
                <span className="hidden md:inline">Skills</span>
              </Link>
            </Button>
            <Button align="navigation" variant={screen === "artifacts" ? "secondary" : "ghost"} className="mt-1" asChild>
              <Link href="/artifacts" aria-current={screen === "artifacts" ? "page" : undefined} aria-label="Artifacts">
                <Files /><span className="hidden md:inline">Artifacts</span>
              </Link>
            </Button>
            <Button align="navigation" variant={screen === "memory" ? "secondary" : "ghost"} className="mt-1" asChild>
              <Link href="/memory" aria-current={screen === "memory" ? "page" : undefined} aria-label="Memory">
                <Brain /><span className="hidden md:inline">Memory</span>
              </Link>
            </Button>
            <Button align="navigation"
              variant={screen === "settings" ? "secondary" : "ghost"}
              className="mt-1"
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
                  : screen === "artifacts"
                    ? "Artifacts"
                    : screen === "memory"
                      ? "Memory"
                      : boardName ?? "Task board"}
          </h1>
          <TrackedCredits />
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <ExecutionActivity />
            <ServerNotifications />
            <ThemeSwitcher />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
