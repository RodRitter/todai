import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";
import { ExecutionService } from "./execution-service.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "todai-worktree-"));
  const repository = join(root, "repo");
  const workspace = join(repository, "src", "app");
  mkdirSync(workspace, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Test User");
  git("config", "user.email", "test@example.com");
  writeFileSync(join(workspace, "source.txt"), "base\n");
  writeFileSync(join(repository, ".gitignore"), "node_modules/\n.angular/\n");
  git("add", "."); git("commit", "-m", "Initial");
  const store = new TaskStore(join(root, "tasks.sqlite"));
  store.setWorkspacePath(workspace);
  store.setWorktreesEnabled(true);
  store.renameColumn("Done", "Done", undefined, true);
  const task = store.save({ id: "one", title: "Change source", description: "", status: "In progress" });
  return { root, repository, workspace, git, store, task, close() { store.close(); rmSync(root, { recursive: true, force: true }); } };
}

test("task worktrees isolate files, preserve the workspace subdirectory, and reuse state", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.workspace, "source.txt"), "main checkout edit\n");
    const activity: import("../domain/execution.ts").RunActivityUpdate[] = [];
    const path = f.store.taskWorkspace(f.task.id, f.workspace, step => activity.push(step));
    assert.deepEqual(activity.map(step => [step.title, step.status]), [["Creating a worktree", "running"], ["Creating a worktree", "complete"]]);
    assert.notEqual(path, f.workspace);
    assert.ok(path.endsWith("/src/app"));
    assert.equal(readFileSync(join(path, "source.txt"), "utf8"), "base\n");
    writeFileSync(join(path, "source.txt"), "task edit\n");
    activity.length = 0;
    assert.equal(f.store.taskWorkspace(f.task.id, f.workspace, step => activity.push(step)), path);
    assert.deepEqual(activity.map(step => [step.title, step.status]), [["Preparing the task worktree", "running"], ["Preparing the task worktree", "complete"]]);
    const other = f.store.save({ id: "two", title: "Other", description: "", status: "In progress" });
    const otherPath = f.store.taskWorkspace(other.id, f.workspace);
    assert.notEqual(otherPath, path);
    assert.equal(readFileSync(join(otherPath, "source.txt"), "utf8"), "base\n");
    assert.equal(readFileSync(join(f.workspace, "source.txt"), "utf8"), "main checkout edit\n");
  } finally { f.close(); }
});

test("Done commits new and changed files, removes caches, retains the branch, and supports reopening", () => {
  const f = fixture();
  try {
    const path = f.store.taskWorkspace(f.task.id, f.workspace);
    writeFileSync(join(path, "source.txt"), "task edit\n");
    writeFileSync(join(path, "new.txt"), "new\n");
    mkdirSync(join(path, "node_modules"));
    writeFileSync(join(path, "node_modules", "cache"), "ignored");
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(done.worktree?.status, "removed");
    assert.equal(existsSync(path), false);
    assert.equal(f.git("show", `${done.worktree!.branch}:src/app/source.txt`), "task edit");
    assert.equal(f.git("show", `${done.worktree!.branch}:src/app/new.txt`), "new");
    assert.ok(!f.git("ls-tree", "-r", done.worktree!.branch).includes("node_modules"));
    assert.equal(f.git("branch", "--show-current"), "main");
    assert.throws(() => f.store.taskWorkspace(f.task.id, f.workspace), /Reopen/);
    f.store.save({ ...done, status: "In progress" });
    assert.equal(f.store.taskWorkspace(f.task.id, f.workspace), path);
    assert.equal(readFileSync(join(path, "new.txt"), "utf8"), "new\n");
  } finally { f.close(); }
});

test("commit failure preserves files and permits explicit retry without bypassing hooks", () => {
  const f = fixture();
  try {
    const path = f.store.taskWorkspace(f.task.id, f.workspace);
    writeFileSync(join(path, "source.txt"), "keep this\n");
    const hook = join(f.repository, ".git", "hooks", "pre-commit");
    writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(done.worktree?.status, "error");
    assert.ok(existsSync(path));
    rmSync(hook);
    f.store.cleanupWorktrees();
    assert.ok(existsSync(path), "Failed cleanup waits for an explicit retry");
    f.store.cleanupWorktrees(f.task.id);
    assert.equal(f.store.readTask(f.task.id)?.worktree?.status, "removed");
    assert.equal(f.git("show", `${done.worktree!.branch}:src/app/source.txt`), "keep this");
  } finally { f.close(); }
});

test("cleanup waits for an active run and execution uses the isolated directory", async () => {
  const f = fixture();
  try {
    f.store.saveAgent({ id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build", permissions: "workspace-write" });
    f.store.assignColumnAgent({ column: "In progress", agentId: "builder" });
    f.store.runTask(f.task.id);
    let path = "";
    const service = new ExecutionService(f.store, async ({ workspace, run }) => {
      if (run.kind === "memory") return "No memory changes.";
      path = workspace;
      assert.notEqual(workspace, f.workspace);
      writeFileSync(join(workspace, "source.txt"), "run change\n");
      const done = f.store.save({ ...f.task, status: "Done" });
      assert.equal(done.worktree?.status, "active");
      assert.ok(existsSync(workspace));
      return "Finished";
    });
    await service.drain();
    assert.ok(path);
    assert.equal(existsSync(path), false, JSON.stringify({task: f.store.readTask(f.task.id), runs: f.store.history()}));
    assert.equal(f.store.readTask(f.task.id)?.worktree?.status, "removed");
  } finally { f.close(); }
});

test("restart completes pending cleanup and repeated cleanup leaves the retained branch intact", () => {
  const f = fixture();
  try {
    const path = f.store.taskWorkspace(f.task.id, f.workspace);
    writeFileSync(join(path, "new.txt"), "recover me");
    // Simulate a committed task transition before the cleanup step starts.
    const db = new DatabaseSync(f.store.databasePath);
    db.prepare("UPDATE tasks SET status = 'Done' WHERE id = ?").run(f.task.id);
    db.close();
    const restarted = new TaskStore(f.store.databasePath, f.store.workspaceId);
    try {
      restarted.cleanupWorktrees();
      const record = restarted.readTask(f.task.id)!.worktree!;
      assert.equal(record.status, "removed");
      restarted.cleanupWorktrees();
      assert.equal(f.git("show", `${record.branch}:src/app/new.txt`), "recover me");
    } finally { restarted.close(); }
  } finally { f.close(); }
});

test("deleted retained branches are not silently replaced", () => {
  const f = fixture();
  try {
    f.store.taskWorkspace(f.task.id, f.workspace);
    const done = f.store.save({ ...f.task, status: "Done" });
    f.git("branch", "-D", done.worktree!.branch);
    f.store.save({ ...done, status: "In progress" });
    assert.throws(() => f.store.taskWorkspace(f.task.id, f.workspace), /branch was deleted/);
    assert.throws(() => f.store.taskWorkspace(f.task.id, f.workspace), /branch was deleted/);
  } finally { f.close(); }
});

test("a switched branch blocks removal without deleting files", () => {
  const f = fixture();
  try {
    const path = f.store.taskWorkspace(f.task.id, f.workspace);
    execFileSync("git", ["-C", path, "switch", "-c", "manual-branch"], { stdio: "pipe" });
    writeFileSync(join(path, "new.txt"), "preserve me");
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(done.worktree?.status, "error");
    assert.match(done.worktree!.error!, /worktree changed/);
    assert.equal(readFileSync(join(path, "new.txt"), "utf8"), "preserve me");
  } finally { f.close(); }
});

test("active processes block cleanup until they stop", async () => {
  const f = fixture();
  const { spawn } = await import("node:child_process");
  let child: ReturnType<typeof spawn> | undefined;
  try {
    const path = f.store.taskWorkspace(f.task.id, f.workspace);
    child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { cwd: path, stdio: "ignore" });
    await new Promise<void>((resolve, reject) => { child!.once("spawn", resolve); child!.once("error", reject); });
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(done.worktree?.status, "error");
    assert.match(done.worktree!.error!, /process still uses/);
    assert.ok(existsSync(path));
    const exited = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
    child.kill("SIGKILL"); await exited;
    f.store.cleanupWorktrees(f.task.id);
    assert.equal(f.store.readTask(f.task.id)?.worktree?.status, "removed");
  } finally { child?.kill("SIGKILL"); f.close(); }
});

test("a missing directory after removal recovers only its own Git registration", () => {
  const f = fixture();
  try {
    f.store.taskWorkspace(f.task.id, f.workspace);
    const record = f.store.readTask(f.task.id)!.worktree!;
    rmSync(record.path, { recursive: true });
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(done.worktree?.status, "removed");
    f.store.save({ ...done, status: "In progress" });
    assert.ok(existsSync(f.store.taskWorkspace(f.task.id, f.workspace)));
  } finally { f.close(); }
});

test("cleanup retains unresolved merge conflicts", () => {
  const f = fixture();
  try {
    const path = f.store.taskWorkspace(f.task.id, f.workspace);
    writeFileSync(join(path, "source.txt"), "task version\n");
    execFileSync("git", ["-C", path, "commit", "-am", "Task change"], { stdio: "pipe" });
    writeFileSync(join(f.workspace, "source.txt"), "main version\n");
    f.git("commit", "-am", "Main change");
    assert.throws(() => execFileSync("git", ["-C", path, "merge", "main"], { stdio: "pipe" }));
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(done.worktree?.status, "error");
    assert.ok(existsSync(path));
    assert.match(readFileSync(join(path, "source.txt"), "utf8"), /<<<<<<< HEAD/);
  } finally { f.close(); }
});

test("task chat uses the worktree and completion chat has no code tools", async () => {
  const f = fixture();
  const { ChatStore } = await import("./chat-store.ts");
  const { sendChat } = await import("./chat-service.ts");
  const chats = new ChatStore(f.store);
  try {
    const result = await sendChat(f.store, chats, f.task.id, "Change the file", async (request) => {
      assert.equal(request.privateChat?.toolsEnabled, true);
      assert.notEqual(request.workspace, f.workspace);
      writeFileSync(join(request.workspace, "source.txt"), "chat change\n");
      return "Changed the file.";
    });
    assert.equal(result.error, null);
    const done = f.store.save({ ...f.task, status: "Done" });
    assert.equal(f.git("show", `${done.worktree!.branch}:src/app/source.txt`), "chat change");
    const discussion = await sendChat(f.store, chats, f.task.id, "Explain the result", async (request) => {
      assert.equal(request.privateChat?.toolsEnabled, false);
      return "The branch contains the change.";
    });
    assert.equal(discussion.error, null);
    assert.equal(f.store.readTask(f.task.id)?.worktree?.status, "removed");
  } finally { chats.close(); f.close(); }
});

test("managed runs stop child processes even when they inherit output pipes", { timeout: 10000 }, async () => {
  const { runCli } = await import("./cli-process.ts");
  const output = await runCli({
    executable: process.execPath, label: "Test agent", cwd: tmpdir(), stopChildren: true, timeout: 5000,
    args: ["-e", "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}); console.log(child.pid); child.unref();"],
  });
  const pid = Number(output.trim());
  assert.ok(pid > 0);
  assert.throws(() => process.kill(pid, 0));
});

test("automatic workflow keeps managed changes unstaged until an explicit move to Done", async () => {
  const f = fixture();
  try {
    f.store.saveAgent({ id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build", permissions: "workspace-write" });
    f.store.assignColumnAgent({ column: "In review", agentId: "builder" });
    f.store.save({ ...f.task, status: "In review", autoRun: true, autoWorkflow: true });
    let path = "";
    const service = new ExecutionService(f.store, async (request) => {
      path = request.workspace;
      const { agentPrompt } = await import("./agent-prompt.ts");
      assert.match(agentPrompt(request), /Leave your file changes unstaged/);
      writeFileSync(join(path, "source.txt"), "review this\n");
      return "Finished";
    });
    await service.drain();
    const task = f.store.readTask(f.task.id)!;
    assert.equal(task.status, "In review");
    assert.equal(task.worktree?.status, "active");
    assert.equal(execFileSync("git", ["-C", path, "diff", "--cached"], { encoding: "utf8" }), "");
    assert.match(execFileSync("git", ["-C", path, "diff"], { encoding: "utf8" }), /review this/);
    assert.equal(f.git("rev-parse", task.worktree!.branch), task.worktree!.baseCommit);
    f.store.save({ ...task, status: "Done" });
    assert.equal(existsSync(path), false);
    assert.equal(f.git("show", `${task.worktree!.branch}:src/app/source.txt`), "review this");
  } finally { f.close(); }
});

for (const action of ["archive", "reset"] as const) {
  for (const completed of [false, true]) {
    test(`${action} removes task worktrees and branches (${completed ? "completed" : "unfinished"})`, () => {
      const f = fixture();
      try {
        const path = f.store.taskWorkspace(f.task.id, f.workspace);
        const record = f.store.readTask(f.task.id)!.worktree!;
        writeFileSync(join(path, "source.txt"), "task edit\n");
        writeFileSync(join(path, "untracked.txt"), "new file\n");
        if (completed) {
          f.store.save({ ...f.task, status: "Done", autoRun: false, autoWorkflow: false });
          f.store.stopTask(f.task.id);
        }
        if (action === "archive") f.store.delete(f.task.id);
        else f.store.reset(f.task.id);
        assert.equal(existsSync(record.path), false);
        assert.equal(f.git("branch", "--list", record.branch), "");
        assert.ok(!f.git("worktree", "list", "--porcelain").includes(record.path));
        assert.equal(f.store.readTask(f.task.id)!.worktree, null);
        assert.equal(readFileSync(join(f.workspace, "source.txt"), "utf8"), "base\n");
        if (action === "reset") {
          const fresh = f.store.taskWorkspace(f.task.id, f.workspace);
          assert.equal(readFileSync(join(fresh, "source.txt"), "utf8"), "base\n");
          assert.equal(existsSync(join(fresh, "untracked.txt")), false);
        }
      } finally { f.close(); }
    });
  }

  test(`${action} recovers after Git resources were already removed`, () => {
    const f = fixture();
    try {
      f.store.taskWorkspace(f.task.id, f.workspace);
      const record = f.store.readTask(f.task.id)!.worktree!;
      f.git("worktree", "remove", record.path);
      f.git("branch", "-D", record.branch);
      if (action === "archive") f.store.delete(f.task.id);
      else f.store.reset(f.task.id);
      assert.equal(f.store.readTask(f.task.id)!.worktree, null);
    } finally { f.close(); }
  });

  test(`${action} preserves task history when cleanup fails and permits retry`, () => {
    const f = fixture();
    try {
      const path = f.store.taskWorkspace(f.task.id, f.workspace);
      const record = f.store.readTask(f.task.id)!.worktree!;
      f.store.addComment({ id: "keep", taskId: f.task.id, authorName: "Human", body: "Keep history", createdAt: new Date().toISOString() });
      execFileSync("git", ["-C", path, "checkout", "-b", "other-branch"], { stdio: "pipe" });
      const perform = () => action === "archive" ? f.store.delete(f.task.id) : f.store.reset(f.task.id);
      assert.throws(perform, /worktree changed/);
      assert.ok(!f.store.readTask(f.task.id)!.archivedAt);
      assert.equal(f.store.readTask(f.task.id)!.comments?.length, 1);
      assert.ok(existsSync(path));
      execFileSync("git", ["-C", path, "checkout", record.branch], { stdio: "pipe" });
      perform();
      assert.equal(existsSync(path), false);
      assert.equal(f.git("branch", "--list", record.branch), "");
      assert.ok(f.git("branch", "--list", "other-branch"));
    } finally { f.close(); }
  });
}

for (const name of [undefined, "", "  ", "feature/custom"]) {
  test(`new task branch name: ${JSON.stringify(name)}`, () => {
    const f = fixture();
    try {
      const task = f.store.save({ ...f.task, id: "custom", branchName: name });
      f.store.save({ ...task, title: "Updated", branchName: "ignored" });
      const reopened = new TaskStore(join(f.root, "tasks.sqlite"));
      try { reopened.taskWorkspace(task.id, f.workspace); } finally { reopened.close(); }
      const record = f.store.readTask(task.id)!.worktree!;
      if (name?.trim()) assert.equal(record.branch, name);
      else assert.match(record.branch, /^todai\/task-/);
      assert.equal(f.git("rev-parse", record.branch), record.baseCommit);
    } finally { f.close(); }
  });
}

test("existing branch names receive the next available numeric suffix", () => {
  const f = fixture();
  try {
    f.git("branch", "feature/custom");
    f.git("branch", "feature/custom-1");
    for (const suffix of [2, 3]) {
      const task = f.store.save({ ...f.task, id: `custom-${suffix}`, branchName: " feature/custom " });
      const path = f.store.taskWorkspace(task.id, f.workspace);
      assert.equal(f.store.readTask(task.id)!.worktree!.branch, `feature/custom-${suffix}`);
      assert.equal(f.store.taskWorkspace(task.id, f.workspace), path);
    }
  } finally { f.close(); }
});

test("invalid branch names are rejected before task creation", () => {
  const f = fixture();
  try {
    for (const branchName of ["bad name", "../bad", "-option", "HEAD", "@{-1}", "x.lock", 123]) {
      assert.throws(() => f.store.save({ ...f.task, id: "invalid", branchName }), /valid Git branch name/);
      assert.equal(f.store.readTask("invalid"), undefined);
    }
  } finally { f.close(); }
});

test("worktree setting persists per workspace and defaults to off", () => {
  const f = fixture();
  try {
    const other = f.store.createWorkspace("Other", f.root);
    const scoped = new TaskStore(f.store.databasePath, other.id);
    try {
      assert.equal(scoped.getWorktreesEnabled(), false);
      f.store.setWorktreesEnabled(false);
      scoped.setWorktreesEnabled(true);
      assert.equal(f.store.getWorktreesEnabled(), false);
      assert.throws(() => scoped.setWorktreesEnabled("false"), /Choose whether/);
      const reopened = new TaskStore(f.store.databasePath, other.id);
      try { assert.equal(reopened.getWorktreesEnabled(), true); } finally { reopened.close(); }
    } finally { scoped.close(); }
  } finally { f.close(); }
});

for (const existing of [false, true]) {
  test(`disabled worktrees use the existing directory without commits (existing worktree: ${existing})`, async () => {
    const f = fixture();
    try {
      const oldPath = existing ? f.store.taskWorkspace(f.task.id, f.workspace) : undefined;
      if (oldPath) writeFileSync(join(oldPath, "source.txt"), "preserved worktree edit\n");
      f.store.setWorktreesEnabled(false);
      const base = f.git("rev-parse", "HEAD");
      const { ChatStore } = await import("./chat-store.ts");
      const { sendChat } = await import("./chat-service.ts");
      const { agentPrompt } = await import("./agent-prompt.ts");
      const chats = new ChatStore(f.store);
      try {
        const result = await sendChat(f.store, chats, f.task.id, "Edit source", async request => {
          assert.equal(request.workspace, realpathSync(f.workspace));
          assert.equal(request.task.worktree, null);
          assert.match(agentPrompt(request), /Use the existing workspace directory/);
          assert.throws(() => f.store.setWorktreesEnabled(true), /wait for chats/);
          writeFileSync(join(request.workspace, "source.txt"), "direct edit\n");
          return "Changed source.";
        });
        assert.equal(result.error, null);
      } finally { chats.close(); }
      f.store.saveAgent({ id: "builder", name: "Builder", tool: "codex", model: "test", effort: "high", instructions: "Build", permissions: "workspace-write" });
      f.store.assignColumnAgent({ column: "In progress", agentId: "builder" });
      f.store.runTask(f.task.id);
      await new ExecutionService(f.store, async request => {
        assert.equal(request.workspace, realpathSync(f.workspace));
        assert.equal(request.task.worktree, null);
        assert.throws(() => f.store.setWorktreesEnabled(true), /Stop running agents/);
        return "Complete";
      }).drain();
      f.store.save({ ...f.task, status: "Done" });
      f.store.cleanupWorktrees(f.task.id);
      assert.equal(f.git("rev-parse", "HEAD"), base);
      assert.equal(f.git("diff", "--cached"), "");
      assert.equal(readFileSync(join(f.workspace, "source.txt"), "utf8"), "direct edit\n");
      if (oldPath) assert.equal(readFileSync(join(oldPath, "source.txt"), "utf8"), "preserved worktree edit\n");
      else assert.equal(f.store.readTask(f.task.id)?.worktree, null);
    } finally { f.close(); }
  });
}
