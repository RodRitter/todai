import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Task, TaskWorktree } from "../domain/task.ts";

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}

export function planWorktree(workspace: string, task: Task, identity: string): TaskWorktree | undefined {
  let repository: string;
  try { repository = git(workspace, "rev-parse", "--show-toplevel"); }
  catch (error) {
    if (String((error as { stderr?: string }).stderr).includes("not a git repository")) return;
    throw error;
  }
  const subdirectory = relative(realpathSync(repository), realpathSync(workspace));
  // An untracked directory inside a repository is not a checkout of that project.
  if (subdirectory && !git(repository, "ls-tree", "HEAD", "--", subdirectory)) return;
  const key = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  const common = git(repository, "rev-parse", "--path-format=absolute", "--git-common-dir");
  return {
    repository, path: join(common, "todai", "worktrees", key),
    subdirectory,
    branch: `todai/task-${task.taskNumber ?? "new"}-${key}`,
    baseBranch: git(repository, "rev-parse", "--abbrev-ref", "HEAD"),
    baseCommit: git(repository, "rev-parse", "HEAD"), status: "creating",
  };
}

function verifyWorktree(record: TaskWorktree) {
  if (realpathSync(git(record.path, "rev-parse", "--show-toplevel")) !== realpathSync(record.path) ||
      git(record.path, "symbolic-ref", "--short", "HEAD") !== record.branch ||
      git(record.path, "rev-parse", "--path-format=absolute", "--git-common-dir") !==
        git(record.repository, "rev-parse", "--path-format=absolute", "--git-common-dir")) {
    throw new Error("The task worktree changed. Restore its branch and repository before retrying.");
  }
}

function assertNoProcesses(path: string) {
  let output: string;
  try {
    output = execFileSync("lsof", ["-a", "-d", "cwd", "-Fpn"], {
      encoding: "utf8", timeout: 5000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    if (failure.status === 1 && !failure.stdout?.trim() && !failure.stderr?.trim()) return;
    throw new Error("Could not check task processes. Keep the worktree and retry cleanup.");
  }
  const canonical = realpathSync(path);
  for (const line of output.split("\n")) {
    if (line.startsWith("n") && (line.slice(1) === canonical || line.slice(1).startsWith(`${canonical}/`)))
      throw new Error("A process still uses the task worktree. Stop it, then retry cleanup.");
  }
}

export function openWorktree(record: TaskWorktree): string {
  if (!existsSync(record.path)) {
    mkdirSync(dirname(record.path), { recursive: true });
    let branchExists = false;
    try { git(record.repository, "show-ref", "--verify", `refs/heads/${record.branch}`); branchExists = true; } catch {}
    if (record.headCommit && !branchExists)
      throw new Error("The task branch was deleted. Restore the branch before running this task.");
    // Recover an interrupted removal before recreating the same managed worktree.
    removeMissingRegistration(record);
    if (branchExists) git(record.repository, "worktree", "add", record.path, record.branch);
    else git(record.repository, "worktree", "add", "-b", record.branch, record.path, record.baseCommit);
  }
  verifyWorktree(record);
  return resolve(record.path, record.subdirectory);
}

function removeMissingRegistration(record: TaskWorktree) {
  if (git(record.repository, "worktree", "list", "--porcelain").split("\n").includes(`worktree ${record.path}`))
    git(record.repository, "worktree", "remove", record.path);
}

function assertRemovableWorktree(record: TaskWorktree) {
  verifyWorktree(record);
  assertNoProcesses(record.path);
  for (const state of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "BISECT_LOG"]) {
    if (existsSync(git(record.path, "rev-parse", "--path-format=absolute", "--git-path", state)))
      throw new Error("Finish the current Git operation before removing the task worktree.");
  }
  if (git(record.path, "ls-files", "--unmerged")) throw new Error("Resolve Git conflicts before removing the task worktree.");
  if (git(record.path, "submodule", "status")) throw new Error("This task has submodules. Preserve their changes before manual cleanup.");
}

// Archive and reset discard the task checkout, including unfinished changes.
// Missing resources are allowed so a partially completed cleanup can be retried.
export function discardWorktree(record: TaskWorktree) {
  if (existsSync(record.path)) {
    assertRemovableWorktree(record);
    git(record.repository, "worktree", "remove", "--force", record.path);
  } else {
    removeMissingRegistration(record);
  }
  if (git(record.repository, "branch", "--list", record.branch))
    git(record.repository, "branch", "-D", "--", record.branch);
}

export function closeWorktree(record: TaskWorktree, task: Task): TaskWorktree {
  if (existsSync(record.path)) {
    assertRemovableWorktree(record);
    git(record.path, "add", "--all");
    if (git(record.path, "diff", "--cached", "--name-only"))
      git(record.path, "commit", "-m", `Complete TASK-${task.taskNumber ?? task.id}: ${task.title}`);
    if (git(record.path, "status", "--porcelain")) throw new Error("The task still has uncommitted changes. Retry cleanup after saving them.");
    verifyWorktree(record);
    assertNoProcesses(record.path);
    const headCommit = git(record.path, "rev-parse", "HEAD");
    // Git removes ignored dependencies and build caches, while retaining the branch.
    git(record.repository, "worktree", "remove", "--force", record.path);
    return { ...record, headCommit, status: "removed", error: undefined };
  }
  const headCommit = git(record.repository, "rev-parse", `refs/heads/${record.branch}`);
  removeMissingRegistration(record);
  return { ...record, headCommit, status: "removed", error: undefined };
}

export function worktreeHead(record: TaskWorktree) {
  return git(record.repository, "rev-parse", `refs/heads/${record.branch}`);
}
