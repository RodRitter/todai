import { orderedReplies } from "./comment-intent.ts";
import { parseFeedback } from "./feedback.ts";
import { processIdentity } from "./process-identity.ts";
import { setTimeout } from "node:timers/promises";
import type { TaskStore, AgentRun } from "./task-store.ts";
import type { Task } from "../domain/task.ts";

export type RunRequest = {
  run: AgentRun;
  task: Task;
  workspace: string;
  signal: AbortSignal;
  onStart: (pid: number) => void;
};
export type Runner = (request: RunRequest) => Promise<string>;

export class ExecutionService {
  private store: TaskStore;
  private runner: Runner;
  private workspace: string | (() => string);
  constructor(
    store: TaskStore,
    runner: Runner,
    workspace: string | (() => string),
  ) {
    this.store = store;
    this.runner = runner;
    this.workspace = workspace;
  }
  save(input: unknown) {
    return this.store.save(input);
  }
  delete(id: string) {
    this.store.delete(id);
  }
  list() {
    return this.store.list();
  }
  history(taskId: string) {
    return this.store.history(taskId);
  }
  async drain() {
    for (const run of this.store.history()) {
      if (
        run.status !== "Running" ||
        (run.ownerPid &&
          run.ownerIdentity &&
          processIdentity(run.ownerPid) === run.ownerIdentity)
      )
        continue;
      if (
        run.runnerPid &&
        run.runnerIdentity &&
        processIdentity(run.runnerPid) === run.runnerIdentity
      ) {
        // The executor and its commands share a process group. Stop orphaned work before claiming another run.
        try {
          process.kill(-run.runnerPid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
        for (
          let attempt = 0;
          attempt < 100 && processExists(-run.runnerPid);
          attempt++
        )
          await setTimeout(50);
        if (processExists(-run.runnerPid))
          throw new Error("Waiting for the previous agent process to stop.");
      }
      this.store.finishRun(
        run.id,
        "Interrupted",
        "Agent run interrupted because the app stopped. Workspace changes were preserved. Move the task to an agent column to start a new run.",
      );
    }
    while (true) {
      const run = this.store.claimRun();
      if (!run) return;
      const task = this.store.list().find((task) => task.id === run.taskId)!;
      const controller = new AbortController();
      const checkInterruption = setInterval(() => {
        if (this.store.interruptionRequested(run.id)) controller.abort();
      }, 50);
      let summary: string;
      try {
        summary = await this.runner({
          run,
          task,
          workspace:
            typeof this.workspace === "function"
              ? this.workspace()
              : this.workspace,
          signal: controller.signal,
          onStart: (pid) => this.store.recordRunner(run.id, pid),
        });
        if (run.kind === "intent") {
          const order = orderedReplies(summary, run.replyPlan ?? []);
          this.store.finishRun(run.id, "Complete", `Reply order: ${order.map((agent) => agent.name).join(" → ")}.`, undefined, order);
          continue;
        }
        const feedback = parseFeedback(summary);
        this.store.finishRun(run.id, feedback ? "Waiting" : "Complete", feedback?.question ?? summary, feedback?.recommendation);
      } catch (error) {
        this.store.finishRun(
          run.id,
          "Failed",
          `Agent run failed: ${error instanceof Error ? error.message : "Unknown execution error."}${run.kind === "intent" ? " Responding in mention order instead." : ""}`,
        );
        continue;
      } finally {
        clearInterval(checkInterruption);
      }
    }
  }
}

function processExists(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
