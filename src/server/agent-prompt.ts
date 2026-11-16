import type { RunRequest } from "./execution-service.ts";

export function agentPrompt({ run, task }: RunRequest) {
  return [
    run.profile.instructions,
    `Task: ${task.title}\n\n${task.description}`,
    "Previous task comments (chronological):",
    ...(task.comments ?? []).map((comment) => `${comment.createdAt}\n${comment.body}`),
    "Work in this project workspace. Finish with a handover summarizing changes, verification, and any unfinished work.",
  ].join("\n\n");
}
