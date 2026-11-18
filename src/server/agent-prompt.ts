import type { RunRequest } from "./execution-service.ts";

export function agentPrompt({ run, task, artifacts }: RunRequest) {
  if (run.prompt != null) return run.prompt;
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
    ...(run.workflowExecutionId ? [`Workflow step instructions:\n${run.stepInstructions ?? ""}`] : []),
    ...(artifacts ? [
      "Todai artifact operations needed for this task are authorized. Attempt the todai_artifacts MCP tools without requesting additional human approval. If a tool call is blocked, report the actual error and continue any independent work; do not assume approval is required or claim an operation succeeded without a successful tool result.",
      "Use the todai_artifacts MCP tools to preserve and reuse results during this run. publish_artifact saves text/Markdown, file bytes (base64), or external links immediately; pass artifactId to publish a revision. search_artifacts discovers workspace metadata and read_artifact fetches content on demand. link_artifact/unlink_artifact manage this task's explicit links. nominate_artifact pins a revision to your final handover or feedback comment. These tools expire when the run ends. Cite exact revisions as [Title](#artifact/ARTIFACT_ID/REVISION_ID). Publication survives interruption, but nominations attach only when your handover or feedback comment is saved.",
      `Current task artifact metadata: ${JSON.stringify(artifacts.context)}`,
    ] : []),
    ...(run.kind === "reply" ? [`Respond to this human comment: ${comment?.body ?? ""}\nUse earlier replies as context. Address the comment's request according to your role.`] : []),
    `Task: ${task.title}\n\n${task.description}`,
    "Previous task comments (chronological):",
    ...(task.comments ?? []).map((comment) => `${comment.createdAt} — ${comment.authorName || "Agent"}\n${comment.body}${comment.recommendation ? `\nRecommendation: ${comment.recommendation}\nFeedback request: ${comment.feedbackStatus}` : ""}`),
    'If you need human feedback before continuing, stop work and make your entire final response a JSON object with exactly this shape: {"type":"feedback_request","question":"Your question with any context needed to resume","recommendation":"Your recommended answer and why"}. Both question and recommendation must be nonempty. Do not wrap the JSON in markdown. This pauses the task until a Human replies; do not claim completion or continue working after requesting feedback. Otherwise finish with your normal handover.',
    "Work in this project workspace. When no human feedback is needed, finish with a handover summarizing changes, verification, and any unfinished work.",
  ].join("\n\n");
}
