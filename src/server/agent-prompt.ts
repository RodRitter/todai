import type { RunRequest } from "./execution-service.ts";

export function agentPrompt({ run, task }: RunRequest) {
  const comment = task.comments?.find((item) => item.id === run.commentId);
  if (run.kind === "intent") return [
    run.profile.instructions,
    JSON.stringify({ task: { title: task.title, description: task.description }, comment: comment?.body,
      agents: run.replyPlan?.map(({ id, name, instructions }) => ({ id, name, instructions })) }),
  ].join("\n\n");
  return [
    `You are ${JSON.stringify(run.profile.name)}, an agent working on this task in the ${JSON.stringify(run.column)} column of Todai. Todai is the task board coordinating your work in this project workspace.`,
    'Your final response is automatically posted as a comment on this task under your agent name. When asked to "leave a comment", put that content in your final response unless the request explicitly identifies another destination. You do not need to post it separately. Previous task comments below provide context from the human and other agents.',
    run.profile.instructions,
    ...(run.kind === "reply" ? [`Respond to this human comment: ${comment?.body ?? ""}\nUse earlier replies as context. Address the comment's request according to your role.`] : []),
    `Task: ${task.title}\n\n${task.description}`,
    "Previous task comments (chronological):",
    ...(task.comments ?? []).map((comment) => `${comment.createdAt} — ${comment.authorName || "Agent"}\n${comment.body}${comment.recommendation ? `\nRecommendation: ${comment.recommendation}\nFeedback request: ${comment.feedbackStatus}` : ""}`),
    'If you need human feedback before continuing, stop work and make your entire final response a JSON object with exactly this shape: {"type":"feedback_request","question":"Your question with any context needed to resume","recommendation":"Your recommended answer and why"}. Both question and recommendation must be nonempty. Do not wrap the JSON in markdown. This pauses the task until a Human replies; do not claim completion or continue working after requesting feedback. Otherwise finish with your normal handover.',
    "Work in this project workspace. When no human feedback is needed, finish with a handover summarizing changes, verification, and any unfinished work.",
  ].join("\n\n");
}
