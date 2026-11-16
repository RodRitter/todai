import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function checkCommand(
  executable: string,
  args: string[],
  cwd: string,
  timeout: number,
  stage: string,
  help: string,
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let diagnostic = "";
    let timedOut = false;
    const capture = (chunk: Buffer) => {
      diagnostic = (diagnostic + chunk.toString()).slice(-4000);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH")
            child.kill("SIGKILL");
        }
      }
    }, timeout);
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(
        error.code === "ENOENT"
          ? "Could not find Codex CLI. Install Codex and ensure `codex` is on the app server's PATH, then restart the server."
          : `${stage}: could not launch Codex CLI (${error.code ?? error.message}). Check executable permissions and restart the server.`,
      ));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (!timedOut && code === 0) return resolve();
      const reason = timedOut
        ? `timed out after ${timeout / 1000} seconds`
        : signal ? `terminated by ${signal}` : `exited with code ${code}`;
      reject(new Error(`${stage}: ${reason}. ${help}${diagnostic.trim() ? `\n\nCodex details:\n${diagnostic.trim()}` : ""}`));
    });
  });
}

export async function testExecutor(executable = "codex", timeout = 60_000) {
  let directory: string | undefined;
  try {
    try {
      directory = await mkdtemp(join(tmpdir(), "todai-executor-test-"));
    } catch {
      throw new Error("Could not prepare the executor test. Check that the app server can write to its temporary directory.");
    }
    await checkCommand(executable, ["--version"], directory, timeout, "CLI availability check", "Check the Codex installation and configuration.");
    await checkCommand(executable, ["login", "status"], directory, timeout, "Sign-in check", "Run `codex login` as the same user running the app server, then retry.");
    const token = randomUUID();
    const output = join(directory, "result.txt");
    await writeFile(join(directory, "probe.txt"), token);
    await checkCommand(executable, [
      "exec", "--cd", directory,
      "--config", 'approval_policy="never"',
      "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral",
      "--color", "never", "--output-last-message", output,
      "Use your shell execution tool to run `cat probe.txt`. Reply with only the exact contents of the file. Do not modify any files.",
    ], directory, timeout, "Tool execution check", "Check the Codex details below for authentication, network, model access, quota, or sandbox errors. Fix the reported issue and retry.");
    const result = await readFile(output, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    });
    if (result.trim() !== token)
      throw new Error("Tool verification failed: Codex finished but did not return the expected file contents. Check that shell execution is enabled and permitted by your Codex configuration, then retry.");
    return { message: "Codex CLI is signed in and successfully executed a command and returned its result." };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
