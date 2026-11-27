import { runWithUsage } from "./usage-store.ts";
import type { TokenUsage } from "../domain/usage.ts";
import { openRunArtifacts, type RunArtifactConnection } from "./run-artifacts.ts";
import { executionWorkspacePath } from "./workspace-settings.ts";
import { orderedReplies } from "./comment-intent.ts";
import { parseFeedback } from "./feedback.ts";
import { processIdentity } from "./process-identity.ts";
import { setTimeout } from "node:timers/promises";
import type { TaskStore, AgentRun } from "./task-store.ts";
import type { Task } from "../domain/task.ts";

export type RunRequest = {
  onActivity?: (activity: import("../domain/execution.ts").RunActivityUpdate) => void;
  onUsage?: (usage: TokenUsage) => void;
  userName?: string;
  workspaceMemory?: import("../domain/memory.ts").MemoryContext;
  run: AgentRun;
  task: Task;
  workspace: string;
  signal: AbortSignal;
  onStart: (pid: number) => void;
  artifacts?: RunArtifactConnection;
  privateChat?: { toolsEnabled?: boolean; messages: import("../domain/task.ts").TaskComment[]; candidates?: import("../domain/column-agent.ts").AgentProfile[] };
};
export type Runner = (request: RunRequest) => Promise<string>;

export class ExecutionService {
  private store: TaskStore;
  private runner: Runner;
  constructor(
    store: TaskStore,
    runner: Runner,
  ) {
    this.store = store;
    this.runner = runner;
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
      this.store.cleanupWorktrees();
      const run = this.store.claimRun();
      if (!run) return;
      const task = this.store.list().find((task) => task.id === run.taskId)!;
      const controller = new AbortController();
      const checkInterruption = setInterval(() => {
        if (this.store.interruptionRequested(run.id)) controller.abort();
      }, 50);
      let summary: string;
      let artifacts: Awaited<ReturnType<typeof openRunArtifacts>> | undefined;
      try {
        if (run.kind !== "intent") artifacts = await openRunArtifacts(this.store, run, controller.signal);
        if (this.store.interruptionRequested(run.id)) controller.abort();
        controller.signal.throwIfAborted();
        const onActivity: NonNullable<RunRequest["onActivity"]> = activity => this.store.recordActivity(run.id, activity);
        const memoryStep = { id: "setup:memory", title: `Checking memories for ${task.title.slice(0, 80)}` };
        onActivity({ ...memoryStep, status: "running" });
        let workspaceMemory: RunRequest["workspaceMemory"];
        try {
          workspaceMemory = this.store.memoryContext(`${task.title} ${task.description}`);
          onActivity({ ...memoryStep, status: "complete", detail: workspaceMemory.entries.map((entry) => `${entry.title} (${entry.id}, revision ${entry.revision})`).join("\n") || "No matching memory was supplied." });
        } catch (error) {
          onActivity({ ...memoryStep, status: "error" });
          throw error;
        }
        const sourceWorkspace = executionWorkspacePath(run.workspacePath);
        const workspace = run.kind === "intent" || run.kind === "memory"
          ? sourceWorkspace : this.store.taskWorkspace(task.id, sourceWorkspace, onActivity);
        summary = await runWithUsage(this.store, this.runner, {
          onActivity,
          userName: this.store.getUserName(),
          workspaceMemory,
          artifacts: artifacts?.connection,
          run,
          task: this.store.executionTask(task.id),
          workspace,
          signal: controller.signal,
          onStart: (pid) => {
            this.store.recordRunner(run.id, pid);
            if (this.store.interruptionRequested(run.id)) controller.abort();
          },
        });
        artifacts?.close();
        if (run.kind === "intent") {
          const order = orderedReplies(summary, run.replyPlan ?? []);
          this.store.finishRun(run.id, "Complete", order.length ? `Reply order: ${order.map((agent) => agent.name).join(" → ")}.` : "No agent replies requested.", undefined, order);
          continue;
        }
        const feedback = run.kind === "memory" ? undefined : artifacts?.feedback ?? parseFeedback(summary);
        this.store.finishRun(run.id, feedback ? "Waiting" : "Complete", feedback?.question ?? summary, feedback?.recommendation, undefined, artifacts?.pending, feedback?.responseType);
      } catch (error) {
        artifacts?.close();
        this.store.finishRun(
          run.id,
          "Failed",
          `Agent run failed: ${error instanceof Error ? error.message : "Unknown execution error."}${run.kind === "intent" ? " No replies were started because the intended responders could not be determined. Post the comment again to retry." : ""}`,
        );
        continue;
      } finally {
        artifacts?.close();
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
