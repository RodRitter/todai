"use client";

import { workspaceFetch } from "@/lib/workspace-fetch";

import { useEffect, useState } from "react";
import { ExternalLink, Server } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkspaceServer } from "@/domain/workspace-server";

export type ServerSnapshot = { workspace: string; servers: WorkspaceServer[] };

function serverUrl(address: string) {
  const reachable = address.replace(/^(\*|0\.0\.0\.0):/, "127.0.0.1:")
    .replace(/^\[::\]:/, "[::1]:");
  return `http://${reachable}`;
}

function DirectoryPath({ directory, workspace }: { directory: string; workspace: string }) {
  const root = workspace.replace(/\/+$/, "");
  const relative = directory === workspace || directory === root
    ? "."
    : directory.startsWith(`${root}/`) ? `./${directory.slice(root.length + 1)}` : directory;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="break-all text-xs text-muted-foreground">{relative}</span>
        </TooltipTrigger>
        <TooltipContent className="break-all">{directory}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

async function loadServers(): Promise<ServerSnapshot> {
  const response = await workspaceFetch("/api/workspace/servers", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not detect workspace servers. Check workspace access and lsof availability.");
  return response.json();
}

export function ServerNotifications({ load = loadServers }: { load?: () => Promise<ServerSnapshot> }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<number | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  async function stopServer(server: WorkspaceServer) {
    setStopping(server.pid);
    setStopError(null);
    try {
      const response = await workspaceFetch("/api/workspace/servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: server.pid, identity: server.identity }),
      });
      if (!response.ok) throw new Error("Could not stop this server. Refresh and try again.");
      setSnapshot(await load());
    } catch {
      setStopError("Could not confirm the server stopped. Check the server list and try again.");
    } finally { setStopping(null); }
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await load();
        if (active) { setSnapshot(result); setError(null); }
      } catch {
        if (active) { setSnapshot(null); setError("Could not detect workspace servers. Check workspace access and lsof availability. Retrying…"); }
      } finally {
        if (active) timer = setTimeout(refresh, 5000);
      }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [load]);

  const serverCount = snapshot?.servers.length ?? 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Running servers" title="Running servers">
          <Server />
          {serverCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              <span aria-hidden="true">{serverCount}</span>
              <span className="sr-only">{serverCount} running servers</span>
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} aria-label="Running workspace servers" className="z-50 w-[30rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold">Running servers</h2>
          </div>
          <div className="max-h-80 overflow-y-auto p-2" aria-live="polite">
            {stopError && <p role="alert" className="p-2 text-sm text-destructive">{stopError}</p>}
            {error ? <p role="alert" className="p-2 text-sm text-destructive">{error}</p>
              : !snapshot ? <p role="status" className="p-2 text-sm text-muted-foreground">Checking for servers…</p>
              : snapshot.servers.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No running servers detected.</p>
              : <ul className="space-y-1">{snapshot.servers.map((server) => (
                <li key={server.pid} className="flex items-center gap-4 rounded-sm bg-muted/40 p-3">
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium"><Server className="size-4 shrink-0" /><span className="break-all">{server.command}</span><span className="text-xs font-normal text-muted-foreground">PID {server.pid}</span></div>
                  <ul className="mt-2 text-sm">{server.addresses.map((address) => (
                    <li key={address} className="break-all font-mono">
                      <a href={serverUrl(address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${address} in browser (new tab)`}>
                        {address}<ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      </a>
                    </li>
                  ))}</ul>
                  <p className="mt-1"><DirectoryPath directory={server.directory} workspace={snapshot.workspace} /></p>
                  </div>
                  <div className="shrink-0">
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10" disabled={stopping !== null || !server.identity} title={!server.identity ? "This process is protected or its identity could not be verified." : "Stop server"} aria-label={`Kill ${server.command} server (PID ${server.pid})`} onClick={() => void stopServer(server)}>
                      {stopping === server.pid ? "Stopping…" : "Kill"}
                    </Button>
                  </div>
                </li>
              ))}</ul>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
