import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";
import { ExecutionService, type Runner } from "./execution-service.ts";

const profile = {
  id: "builder",
  name: "Builder",
  tool: "codex",
  model: "test-model",
  effort: "high",
  instructions: "Build carefully",
  permissions: "workspace-write",
};
function fixture(runner: Runner) {
  const directory = mkdtempSync(join(tmpdir(), "todai-execution-"));
  const store = new TaskStore(join(directory, "tasks.sqlite"));
  store.saveAgent(profile);
  store.assignColumnAgent({ column: "In progress", agentId: "builder" });
  const service = new ExecutionService(store, runner);
  return {
    store,
    service,
    directory,
    cleanup() {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("a move to an assigned column queues a run, with a profile snapshot", async () => {
  const f = fixture(async () => "Finished");
  try {
    const task = f.service.save({
      autoRun: true,
      id: "one",
      title: "Build",
      description: "A board",
      status: "To do",
    });
    assert.equal(f.service.history("one").length, 0);
    const moved = f.service.save({ ...task, status: "In progress" });
    assert.equal(moved.agentStatus, "Queued");
    f.service.save(moved);
    f.service.list();
    f.store.saveAgent({ ...profile, model: "changed" });
    assert.equal(f.service.history("one").length, 1);
    assert.equal(f.service.history("one")[0].profile.model, "test-model");
    await f.service.drain();
  } finally {
    f.cleanup();
  }
});

test("runs are serialized across services and completion persists handovers without moving tasks", async () => {
  const started: string[] = [];
  let finish!: (summary: string) => void;
  const f = fixture(({ task }) => {
    started.push(task.id);
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  try {
    for (const id of ["one", "two"]) {
      const task = f.service.save({
        autoRun: true,
        id,
        title: id,
        description: "",
        status: "To do",
      });
      f.service.save({ ...task, status: "In progress" });
    }
    const draining = f.service.drain();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(started, ["one"]);
    assert.deepEqual(
      f.service.list().map((task) => task.agentStatus),
      ["Running", "Queued"],
    );
    const other = new ExecutionService(
      f.store,
      async () => {
        throw new Error("overlap");
      },
    );
    await other.drain();
    f.store.saveAgent({ ...profile, name: "Renamed builder" });
    finish("Implemented the board");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(started, ["one", "two"]);
    finish("Reviewed the board");
    await draining;
    const reopened = new TaskStore(join(f.directory, "tasks.sqlite"));
    try {
      assert.deepEqual(
        reopened.list().map((task) => [task.status, task.agentStatus]),
        [
          ["In progress", "Complete"],
          ["In progress", "Complete"],
        ],
      );
      assert.equal(
        reopened.list()[0].comments?.[0].body,
        "Implemented the board",
      );
      assert.equal(reopened.list()[0].comments?.[0].authorName, "Builder");
      assert.equal(reopened.history("one")[0].summary, "Implemented the board");
    } finally {
      reopened.close();
    }
  } finally {
    f.cleanup();
  }
});

test("failed launches release the queue and later loops receive earlier handovers", async () => {
  const contexts: string[][] = [];
  const f = fixture(async ({ task }) => {
    if (task.id === "bad") throw new Error("Codex executable was not found");
    contexts.push(task.comments?.map((comment) => comment.body) ?? []);
    return "Ready for review";
  });
  try {
    for (const id of ["bad", "good"]) {
      const task = f.service.save({
        autoRun: true,
        id,
        title: id,
        description: "Task details",
        status: "To do",
      });
      f.service.save({ ...task, status: "In progress" });
    }
    await f.service.drain();
    assert.equal(f.service.list()[0].agentStatus, "Failed");
    assert.match(
      f.service.history("bad")[0].summary!,
      /Codex executable was not found/,
    );
    f.store.assignColumnAgent({ column: "In review", agentId: "builder" });
    f.service.save({ ...f.service.list()[1], status: "In review" });
    await f.service.drain();
    assert.deepEqual(contexts, [[], ["Ready for review"]]);
    assert.equal(f.service.history("good").length, 2);
    assert.equal(f.service.list()[1].status, "In review");
  } finally {
    f.cleanup();
  }
});

test("pending tasks can move but cannot disappear until execution ends", async () => {
  const f = fixture(async () => "Done");
  try {
    const task = f.service.save({
      autoRun: true,
      id: "one",
      title: "Build",
      description: "",
      status: "To do",
    });
    const queued = f.service.save({ ...task, status: "In progress" });
    f.store.assignColumnAgent({ column: "In review", agentId: "builder" });
    f.service.save({ ...queued, status: "In review" });
    f.service.save({ ...queued, status: "Done" });
    f.service.save({ ...queued, status: "In review" });
    assert.equal(
      f.service.history("one").filter((run) => run.status === "Queued").length,
      1,
    );
    assert.equal(
      f.service.history("one").find((run) => run.status === "Queued")?.column,
      "In review",
    );
    assert.throws(() => f.service.delete(task.id), /Wait for/);
    assert.equal(f.service.list()[0].status, "In review");
    await f.service.drain();
    f.service.save({ ...queued, status: "Done" });
    f.service.delete(task.id);
    assert.deepEqual(f.service.list(), []);
  } finally {
    f.cleanup();
  }
});

test("restart surfaces an abandoned run, resumes queued work, and never reruns completed work", async () => {
  const { spawnSync } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const executed: string[] = [];
  const f = fixture(async ({ task }) => {
    executed.push(task.id);
    return "Finished once";
  });
  try {
    for (const id of ["abandoned", "waiting"]) {
      const task = f.service.save({
        autoRun: true,
        id,
        title: id,
        description: "",
        status: "To do",
      });
      f.service.save({ ...task, status: "In progress" });
    }
    const child = spawnSync(process.execPath, [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `
      import { spawn } from 'node:child_process';
      import { TaskStore } from ${JSON.stringify(pathToFileURL(join(process.cwd(), "src/server/task-store.ts")).href)};
      import { ExecutionService } from ${JSON.stringify(pathToFileURL(join(process.cwd(), "src/server/execution-service.ts")).href)};
      const store = new TaskStore(${JSON.stringify(join(f.directory, "tasks.sqlite"))});
      const service = new ExecutionService(store, async ({ onStart }) => {
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
        onStart(child.pid);
        child.unref();
        process.exit(0);
      });
      await service.drain();
    `,
    ]);
    assert.equal(child.status, 0, child.stderr.toString());
    assert.equal(f.service.list()[0].agentStatus, "Running");
    const orphanPid = f.service.history("abandoned")[0].runnerPid!;
    assert.doesNotThrow(() => process.kill(orphanPid, 0));
    await f.service.drain();
    assert.equal(f.service.list()[0].agentStatus, "Interrupted");
    assert.throws(() => process.kill(orphanPid, 0));
    assert.match(f.service.list()[0].comments![0].body, /restart|stopped/);
    assert.deepEqual(executed, ["waiting"]);
    const restarted = new ExecutionService(
      f.store,
      async () => {
        throw new Error("must not rerun");
      },
    );
    await restarted.drain();
    assert.equal(restarted.list()[1].agentStatus, "Complete");
  } finally {
    f.cleanup();
  }
});

test("restart does not treat a reused owner PID as the original app process", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const f = fixture(async () => "Should not rerun");
  try {
    const task = f.service.save({
      autoRun: true,
      id: "stale",
      title: "Old work",
      description: "",
      status: "To do",
    });
    f.service.save({ ...task, status: "In progress" });
    // Model an archived database whose original owner PID now belongs to this test process.
    const archived = new DatabaseSync(join(f.directory, "tasks.sqlite"));
    archived
      .prepare(
        "UPDATE runs SET status = 'Running', ownerPid = ?, ownerIdentity = 'previous process start time', runnerPid = ?, runnerIdentity = 'previous process start time' WHERE taskId = 'stale'",
      )
      .run(process.pid, process.pid);
    archived.close();
    await f.service.drain();
    assert.equal(f.service.history("stale")[0].status, "Interrupted");
  } finally {
    f.cleanup();
  }
});

test("creating in To do with an assigned agent queues once, including retries after completion", async () => {
  const executed: string[] = [];
  const f = fixture(async ({ task }) => {
    executed.push(task.id);
    return "Created task finished";
  });
  try {
    f.store.assignColumnAgent({ column: "To do", agentId: "builder" });
    const input = {
      autoRun: true,
      id: "created",
      title: "New task",
      description: "Run on creation",
      status: "To do",
    };
    assert.equal(f.service.save(input).agentStatus, "Queued");
    f.service.save(input);
    assert.equal(f.service.history(input.id).length, 1);
    await f.service.drain();
    assert.deepEqual(executed, ["created"]);
    assert.equal(
      f.service.list()[0].comments?.[0].body,
      "Created task finished",
    );
    assert.equal(f.service.save(input).agentStatus, "Complete");
    await f.service.drain();
    assert.equal(f.service.history(input.id).length, 1);
    assert.deepEqual(executed, ["created"]);
  } finally {
    f.cleanup();
  }
});

test("older handovers recover their agent name while unmatched comments keep an unknown author", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const f = fixture(async () => "A saved handover");
  try {
    f.service.save({
      autoRun: true,
      id: "old",
      title: "Earlier work",
      description: "",
      status: "In progress",
    });
    await f.service.drain();
    f.store.addComment({
      id: "unknown",
      taskId: "old",
      body: "Earlier note",
      createdAt: "2026-01-01T00:00:00Z",
    });
    f.store.deleteAgent("builder");
    // Recreate the pre-author schema while preserving its tasks, comments and run snapshots.
    const legacy = new DatabaseSync(join(f.directory, "tasks.sqlite"));
    legacy.exec("ALTER TABLE comments DROP COLUMN authorName");
    legacy.close();
    const reopened = new TaskStore(join(f.directory, "tasks.sqlite"));
    try {
      const comments = reopened.list()[0].comments!;
      assert.equal(
        comments.find((comment) => comment.body === "A saved handover")
          ?.authorName,
        "Builder",
      );
      assert.equal(
        comments.find((comment) => comment.id === "unknown")?.authorName,
        null,
      );
    } finally {
      reopened.close();
    }
  } finally {
    f.cleanup();
  }
});

test("redirecting active work waits for exit, keeps only the latest destination, and ignores late success", async () => {
  const started: string[] = [];
  let exit!: (summary: string) => void;
  let stopped!: () => void;
  const stopRequested = new Promise<void>((resolve) => {
    stopped = resolve;
  });
  const contexts: string[][] = [];
  const f = fixture(({ run, task, signal }) => {
    started.push(`${task.id}:${run.column}`);
    contexts.push(task.comments?.map((comment) => comment.body) ?? []);
    if (started.length === 1) {
      signal.addEventListener("abort", stopped, { once: true });
      return new Promise((resolve) => {
        exit = resolve;
      });
    }
    return Promise.resolve("Replacement finished");
  });
  let draining: Promise<void> | undefined;
  const otherStore = new TaskStore(join(f.directory, "tasks.sqlite"));
  try {
    f.store.assignColumnAgent({ column: "In review", agentId: "builder" });
    const task = f.service.save({
      autoRun: true,
      id: "redirect",
      title: "Build",
      description: "",
      status: "In progress",
    });
    draining = f.service.drain();
    f.service.save({ ...task, status: "In progress" });
    assert.equal(f.service.history(task.id).length, 1);
    // API requests use a separate connection from the scheduler.
    otherStore.save({ ...task, status: "In review" });
    otherStore.save({ ...task, status: "Done" });
    otherStore.save({ ...task, status: "In review" });
    await Promise.race([
      stopRequested,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Run was not stopped")),
          1000,
        ).unref(),
      ),
    ]);
    f.service.save({
      autoRun: true,
      id: "waiting",
      title: "Other work",
      description: "",
      status: "In progress",
    });
    await new ExecutionService(
      otherStore,
      async () => {
        throw new Error("overlap");
      },
    ).drain();
    assert.deepEqual(started, ["redirect:In progress"]);
    assert.equal(
      f.service.history(task.id).filter((run) => run.status === "Queued")
        .length,
      1,
    );
    exit("Late success must not become a handover");
    await draining;
    assert.deepEqual(started, [
      "redirect:In progress",
      "redirect:In review",
      "waiting:In progress",
    ]);
    assert.equal(f.service.history(task.id)[0].status, "Interrupted");
    assert.match(contexts[1][0], /interrupted.*In review/);
    assert.equal(f.service.list()[0].status, "In review");
    assert.equal(f.service.list()[0].agentStatus, "Complete");
    assert.equal(
      f.service
        .list()[0]
        .comments?.some((comment) => comment.body.includes("Late success")),
      false,
    );
    assert.equal(otherStore.list()[0].comments?.[0].body, contexts[1][0]);
  } finally {
    exit?.("Cleanup");
    await draining;
    otherStore.close();
    f.cleanup();
  }
});

test("moving away and back still interrupts, even when success arrives before cancellation polling", async () => {
  let finish!: (summary: string) => void;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  try {
    const task = f.service.save({
      autoRun: true,
      id: "quick",
      title: "Quick move",
      description: "",
      status: "In progress",
    });
    const draining = f.service.drain();
    f.service.save({ ...task, status: "Done" });
    f.store.assignColumnAgent({ column: "In progress", agentId: null });
    f.service.save({ ...task, status: "In progress" });
    finish("Late result");
    await draining;
    assert.equal(f.service.list()[0].agentStatus, "Interrupted");
    assert.equal(f.service.history(task.id).length, 1);
    assert.equal(f.service.history(task.id)[0].status, "Interrupted");
    assert.match(f.service.list()[0].comments![0].body, /moved to In progress/);
    await f.service.drain();
    assert.equal(f.service.history(task.id).length, 1);
  } finally {
    f.cleanup();
  }
});

test("auto-workflow preserves completion in Done and queues assigned next columns", () => {
  const f = fixture(async () => "Unused");
  try {
    f.store.assignColumnAgent({ column: "In review", agentId: "builder" });
    f.service.save({ autoRun: true, id: "auto", title: "Build", description: "", status: "In progress", autoWorkflow: true });
    f.store.finishRun(f.store.claimRun()!.id, "Complete", "Built");
    assert.equal(f.store.list()[0].status, "In review");
    assert.equal(f.store.list()[0].agentStatus, "Queued");
    const review = f.store.claimRun()!;
    assert.equal(f.store.list()[0].agentStatus, "Running");
    f.store.finishRun(review.id, "Complete", "Reviewed");
    assert.equal(f.store.list()[0].status, "Done");
    assert.equal(f.store.list()[0].agentStatus, "Complete");
    assert.equal(f.store.claimRun(), undefined);
    const reopened = new TaskStore(join(f.directory, "tasks.sqlite"));
    try { assert.equal(reopened.list()[0].agentStatus, "Complete"); }
    finally { reopened.close(); }
  } finally { f.cleanup(); }
});

for (const outcome of ["Complete", "Failed", "Interrupted"] as const) {
  test(`manual moves preserve ${outcome} until another agent is queued`, () => {
    const f = fixture(async () => "Unused");
    try {
      f.service.save({ autoRun: true, id: "one", title: "Build", description: "", status: "In progress" });
      f.store.finishRun(f.store.claimRun()!.id, outcome, "Result");
      const moved = f.store.save({ ...f.store.list()[0], status: "Done" });
      assert.equal(moved.agentStatus, outcome);
      assert.equal(f.store.save({ ...moved, status: "In progress" }).agentStatus, "Queued");
    } finally { f.cleanup(); }
  });
}

test("auto-workflow follows column order, chains agents with handovers, and stops at an unassigned column", async () => {
  const contexts: string[][] = [];
  const f = fixture(async ({ task }) => {
    contexts.push(task.comments?.map((comment) => comment.body) ?? []);
    return `Finished ${task.status}`;
  });
  try {
    f.store.createColumn("Approval");
    f.store.reorderColumns([
      "To do",
      "In progress",
      "In review",
      "Approval",
      "Done",
    ]);
    f.store.assignColumnAgent({ column: "In review", agentId: "builder" });
    f.service.save({
      autoRun: true,
      id: "auto",
      title: "Build",
      description: "",
      status: "In progress",
      autoWorkflow: true,
    });
    await f.service.drain();
    assert.deepEqual(contexts, [[], ["Finished In progress"]]);
    assert.equal(f.service.list()[0].status, "Approval");
    assert.equal(f.service.list()[0].agentStatus, "Complete");
    assert.equal(f.service.list()[0].autoWorkflow, true);
    assert.deepEqual(
      f.service.history("auto").map((run) => run.status),
      ["Complete", "Complete"],
    );
    await f.service.drain();
    assert.equal(f.service.history("auto").length, 2);
  } finally {
    f.cleanup();
  }
});

for (const outcome of ["Complete", "Failed", "Interrupted"] as const) {
  test(`auto-workflow handles ${outcome} once and stays in the last column`, () => {
    const f = fixture(async () => "Unused");
    try {
      f.service.save({
        autoRun: true,
        id: "auto",
        title: "Build",
        description: "",
        status: "In progress",
        autoWorkflow: true,
      });
      const run = f.store.claimRun()!;
      f.store.finishRun(run.id, outcome, "Result");
      f.store.finishRun(run.id, outcome, "Duplicate");
      assert.equal(
        f.service.list()[0].status,
        outcome === "Complete" ? "In review" : "In progress",
      );
      assert.equal(f.service.list()[0].comments?.length, 1);
      f.store.assignColumnAgent({ column: "Done", agentId: "builder" });
      f.service.save({ ...f.service.list()[0], status: "Done" });
      f.store.finishRun(f.store.claimRun()!.id, outcome, "Last column");
      assert.equal(f.service.list()[0].status, "Done");
      assert.equal(f.service.list()[0].agentStatus, outcome);
    } finally {
      f.cleanup();
    }
  });
}

test("auto-workflow respects disabling and manual moves while a run is active", () => {
  const f = fixture(async () => "Unused");
  try {
    const task = f.service.save({
      autoRun: true,
      id: "auto",
      title: "Build",
      description: "",
      status: "In progress",
      autoWorkflow: true,
    });
    const run = f.store.claimRun()!;
    f.service.save({ ...task, autoWorkflow: false });
    f.store.finishRun(run.id, "Complete", "Finished");
    assert.equal(f.service.list()[0].status, "In progress");
    f.service.save({ ...task, status: "To do" });
    f.service.save(task);
    const nextRun = f.store.claimRun()!;
    f.service.save({ ...task, status: "In review" });
    f.store.finishRun(nextRun.id, "Complete", "Late result");
    assert.equal(f.service.list()[0].status, "In review");
    assert.equal(f.service.list()[0].agentStatus, "Interrupted");
  } finally {
    f.cleanup();
  }
});

test("feedback persists, releases the queue, and resumes the same agent with Human context", async () => {
  let resumed = false;
  const f = fixture(async ({ task, run }) => {
    if (task.id === "other") return "Other work done";
    const reply = task.comments?.find((comment) => comment.authorName === "Human");
    if (reply) {
      assert.equal(reply.body, "Use the recommended approach");
      assert.equal(run.profile.model, "test-model");
      resumed = true;
      return "Completed with feedback";
    }
    return JSON.stringify({ type: "feedback_request", question: "Which approach?", recommendation: "Use the simpler approach." });
  });
  try {
    f.service.save({ autoRun: true, id: "one", title: "Build", description: "", status: "In progress", autoWorkflow: true });
    f.service.save({ autoRun: true, id: "other", title: "Other", description: "", status: "In progress" });
    await f.service.drain();
    let task = f.store.list().find((item) => item.id === "one")!;
    assert.equal(task.agentStatus, "Waiting");
    assert.equal(task.status, "In progress");
    assert.equal(f.store.list().find((item) => item.id === "other")!.agentStatus, "Complete");
    const request = task.comments![0];
    assert.equal(request.feedbackStatus, "pending");
    assert.equal(request.recommendation, "Use the simpler approach.");
    assert.throws(() => f.store.answerFeedback("one", request.id, "  "), /Enter a feedback/);
    const reopened = new TaskStore(join(f.directory, "tasks.sqlite"));
    try {
      assert.equal(reopened.list()[0].agentStatus, "Waiting");
      f.store.saveAgent({ ...profile, model: "changed" });
      task = reopened.answerFeedback("one", request.id, " Use the recommended approach ");
      assert.equal(task.agentStatus, "Queued");
      assert.equal(task.comments![0].feedbackStatus, "answered");
      assert.throws(() => f.store.answerFeedback("one", request.id, "Again"), /no longer pending/);
    } finally { reopened.close(); }
    await f.service.drain();
    assert.equal(resumed, true);
    assert.equal(f.store.list()[0].status, "In review");
    assert.equal(f.store.history("one").length, 2);
  } finally { f.cleanup(); }
});

test("moving a waiting task cancels feedback and rejects stale replies", async () => {
  const f = fixture(async () => JSON.stringify({ type: "feedback_request", question: "Proceed?", recommendation: "Yes." }));
  try {
    f.service.save({ autoRun: true, id: "one", title: "Build", description: "", status: "In progress" });
    await f.service.drain();
    const task = f.store.list()[0];
    const request = task.comments![0];
    const moved = f.store.save({ ...task, status: "Done" });
    assert.equal(moved.agentStatus, "Not started");
    assert.equal(moved.comments![0].feedbackStatus, "cancelled");
    assert.throws(() => f.store.answerFeedback(task.id, request.id, "Yes"), /no longer pending/);
    assert.equal(f.store.history().length, 1);
  } finally { f.cleanup(); }
});

test("invalid feedback cannot complete or advance a task", async () => {
  const f = fixture(async () => '{"type":"feedback_request","question":"Proceed?","recommendation":""}');
  try {
    f.service.save({ autoRun: true, id: "one", title: "Build", description: "", status: "In progress", autoWorkflow: true });
    await f.service.drain();
    assert.equal(f.store.list()[0].agentStatus, "Failed");
    assert.equal(f.store.list()[0].status, "In progress");
    assert.equal(f.store.list()[0].comments![0].feedbackStatus, null);
  } finally { f.cleanup(); }
});

test("a move during a run takes precedence over its feedback request", async () => {
  const f = fixture(async ({ task }) => {
    f.store.save({ ...task, status: "Done" });
    return '{"type":"feedback_request","question":"Proceed?","recommendation":"Yes"}';
  });
  try {
    f.service.save({ autoRun: true, id: "one", title: "Build", description: "", status: "In progress" });
    await f.service.drain();
    assert.equal(f.store.list()[0].agentStatus, "Interrupted");
    assert.equal(f.store.list()[0].comments![0].feedbackStatus, null);
  } finally { f.cleanup(); }
});
