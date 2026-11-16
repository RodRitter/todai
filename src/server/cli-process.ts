import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

// Both executors must own a process group so cancellation also stops their commands.
export async function runCli({ executable, label, args, cwd, input = "", signal, onStart = () => {}, timeout = 0 }: {
  executable: string; label: string; args: string[]; cwd: string; input?: string;
  signal?: AbortSignal; onStart?: (pid: number) => void; timeout?: number;
}): Promise<string> {
  let pid: number | undefined;
  let stopped = false;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let failure: Error | undefined;
  const stop = () => {
    if (!pid) return;
    try { process.kill(-pid, "SIGKILL"); stopped = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  };
  try {
    signal?.throwIfAborted();
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(executable, args, { cwd, detached: true, stdio: ["pipe", "pipe", "pipe"] });
      pid = child.pid;
      let stdout = "";
      let stderr = "";
      signal?.addEventListener("abort", stop, { once: true });
      if (signal?.aborted) stop();
      if (timeout) timer = globalThis.setTimeout(() => {
        failure = new Error(`${label} timed out after ${timeout / 1000} seconds.`);
        stop();
      }, timeout);
      child.stdout.on("data", (chunk) => {
        if (failure) return;
        stdout += chunk.toString();
        if (stdout.length > 4_000_000) {
          failure = new Error(`${label} returned too much output.`);
          stop();
        }
      });
      child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-4000); });
      child.on("error", (error: NodeJS.ErrnoException) => reject(new Error(
        `Could not launch ${label}: ${error.code === "ENOENT" ? `install ${executable} and ensure it is on the app server's PATH` : error.message}.`,
      )));
      child.stdin.on("error", () => { /* close/error reports broken input pipes */ });
      child.on("close", (code, exitSignal) => {
        if (failure) reject(failure);
        else if (signal?.aborted) reject(new Error(`${label} was interrupted.`));
        else if (code === 0) resolve(stdout);
        else reject(new Error(`${label} exited ${exitSignal ? `with signal ${exitSignal}` : `with code ${code}`}.${stderr || stdout ? `\n${(stderr || stdout).trim().slice(-4000)}` : ""}`));
      });
      if (pid) {
        try { onStart(pid); }
        catch (error) { failure = error instanceof Error ? error : new Error(String(error)); stop(); }
      }
      child.stdin.end(input);
    });
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
    while (stopped && pid && groupExists(pid)) await setTimeout(20);
  }
}

function groupExists(pid: number) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}
