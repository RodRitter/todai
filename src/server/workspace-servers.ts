import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { promisify } from "node:util";
import type { WorkspaceServer } from "../domain/workspace-server.ts";
import { processIdentity } from "./process-identity.ts";

const execute = promisify(execFile);

export function isWithinWorkspace(workspace: string, directory: string) {
  const path = relative(workspace, directory);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

export function parseListeners(output: string): Omit<WorkspaceServer, "directory">[] {
  const processes: Omit<WorkspaceServer, "directory">[] = [];
  let current: (typeof processes)[number] | undefined;
  for (const line of output.split("\n")) {
    if (line.startsWith("p")) {
      current = { pid: Number(line.slice(1)), command: "", addresses: [] };
      processes.push(current);
    } else if (current && line.startsWith("c")) current.command = line.slice(1);
    else if (current && line.startsWith("n") && !current.addresses.includes(line.slice(1))) {
      current.addresses.push(line.slice(1));
    }
  }
  return processes.filter((process) => Number.isInteger(process.pid) && process.pid > 0 && process.addresses.length);
}

async function lsof(args: string[]) {
  try {
    const { stdout, stderr } = await execute("lsof", args, { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
    if (stderr.trim()) throw new Error("Process inspection returned warnings.");
    return stdout;
  } catch (error) {
    const failure = error as { code?: unknown; stdout?: string; stderr?: string };
    // lsof exits with 1 when no matching processes remain.
    if (failure.code === 1 && !failure.stderr?.trim() && !failure.stdout?.trim()) return "";
    throw error;
  }
}

export async function detectWorkspaceServers(path: string): Promise<WorkspaceServer[]> {
  const workspace = await realpath(path);
  const listeners = parseListeners(await lsof(["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"]));
  if (!listeners.length) return [];
  const output = await lsof(["-a", "-p", listeners.map(({ pid }) => pid).join(","), "-d", "cwd", "-Fpn"]);
  const directories = new Map<number, string>();
  let pid = 0;
  for (const line of output.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n")) directories.set(pid, line.slice(1));
  }
  const results = await Promise.all(listeners.map(async (listener) => {
    const directory = directories.get(listener.pid);
    if (!directory) return null;
    try {
      const canonical = await realpath(directory);
      return isWithinWorkspace(workspace, canonical) ? { ...listener, directory: canonical } : null;
    } catch {
      return null; // The process or its directory may have disappeared during inspection.
    }
  }));
  return results.filter((server): server is WorkspaceServer => server !== null)
    .sort((a, b) => a.command.localeCompare(b.command) || a.pid - b.pid);
}

export function serverIdentity(pid: number): string | undefined {
  if (pid === process.pid || pid === process.ppid) return undefined;
  try { return processIdentity(pid) ?? undefined; } catch { return undefined; }
}

export async function stopWorkspaceServer(path: string, pid: number, identity: string) {
  if (pid === process.pid || pid === process.ppid) throw new Error("Todai cannot stop its own server.");
  if (serverIdentity(pid) !== identity) throw new Error("The server process has changed or exited. Refresh and try again.");
  const servers = await detectWorkspaceServers(path);
  if (!servers.some((server) => server.pid === pid)) throw new Error("This server no longer belongs to the workspace.");
  if (serverIdentity(pid) !== identity) throw new Error("The server process has changed or exited. Refresh and try again.");
  process.kill(pid, "SIGTERM");
}
