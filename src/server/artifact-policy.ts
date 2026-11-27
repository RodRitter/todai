// Shared by the run prompt and publication tool so the same bar applies at both decision points.
export const artifactPublicationPolicy = [
  "Use Activity messages for concise answers, status updates, feedback questions, and handovers.",
  "Move supporting information into an artifact when its length or format would obscure the comment's main point or disrupt its structure. Examples include detailed evidence, long code or log excerpts, large tables, research findings, and detailed plans. This material does not need reuse beyond the current exchange to qualify.",
  "Also create artifacts for substantial reusable context or deliverables the human requests as artifacts or files. Remove repetition before deciding that an artifact is needed. A normal run may produce no artifacts.",
  "Keep each artifact self-contained. Distinguish verified facts from assumptions and include sources or verification where relevant. Leave routine execution output in run history; publish selected evidence when the comment needs a separate supporting document.",
  "Before publishing, check existing messages and artifacts. Reuse or update an existing artifact when it covers the same material.",
  "Publish the artifact before citing it. Use the returned ID in a descriptive Markdown link: [Evidence report](#artifact/ARTIFACT_ID). Put the link beside the supported summary within the comment. An attachment alone does not replace this link. Keep the outcome, blockers, material limitations, decision needed, and next action in the comment. Keep detailed supporting content in the artifact without duplicating it in the comment.",
].join("\n\n");
