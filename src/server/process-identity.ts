import { execFileSync } from "node:child_process";

// PIDs can be reused after a shutdown. Never recover or signal a process on PID alone.
export function processIdentity(pid: number): string | null {
  try {
    return (
      execFileSync("ps", ["-p", String(pid), "-o", "lstart="], {
        encoding: "utf8",
        env: { ...process.env, LC_ALL: "C" },
        timeout: 5000,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim() || null
    );
  } catch (error) {
    if ((error as { status?: number }).status === 1) return null; // Process has exited.
    throw new Error(
      "Could not verify the previous agent process. Check local process access before retrying.",
      { cause: error },
    );
  }
}
