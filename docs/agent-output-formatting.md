# Agent output formatting

## Writing contract

The local language reference is [Common writing rules](writing-rules.md). The authoritative output policy lives in `src/server/agent-output-policy.ts`. `agentPrompt` includes that policy in every task and reply run. Read both before changing agent comments, feedback text, handovers, or prompt formatting. Intent classification retains its machine-readable protocol.

User-facing content is Markdown, including the `question` and `recommendation` values in the `request_feedback` MCP arguments or the legacy feedback JSON envelope. Formatting never changes execution or approval semantics.

## Presentation contract

Apply these rules when implementing or changing output surfaces. They specify the intended presentation; adding prompt instructions alone does not implement new UI components.

- Render message bodies and feedback fields through the shared `Markdown` component. Preserve headings, lists, inline code, fenced blocks, and links when displaying or copying content.
- Present external references beside their supported claims using the [shadcn Inline Citation pattern](https://ui.shadcn.com/docs/ai-elements/base/inline-citation). Keep the Markdown link as the portable source; the renderer owns the compact citation trigger and source preview. Show the source title and hostname, with a keyboard- and touch-accessible link. Preview content must come from available source metadata, not invented summaries. Preserve internal artifact revision links.
- Organize supporting execution detail with shared shadcn-style components, adapted to the app's Radix primitives. Use `Trace` and `TraceCollapsible` for run history; use an accordion for independent detail sections when appropriate. Extend shared components with typed variants instead of styling each message separately.
- Follow the [Terminal pattern](https://ui.shadcn.com/docs/ai-elements/base/terminal): show the command and recorded status in the trigger, with output in a code block inside the collapsible body. Preserve output whitespace and provide a bounded scrolling area for long logs. A failed command must remain identifiable while collapsed.
- Follow the [Subagent pattern](https://ui.shadcn.com/docs/ai-elements/base/subagent): show the agent/task and recorded status in the trigger; put the assignment, nested activity, and result inside. Show model, tools, and duration only when recorded. Keep nested results mounted across collapse.
- Keep the outcome, blockers, feedback question, recommendation, and required next action visible. Collapse supporting detail, not information needed to make a decision. Preserve user expansion choices while updates arrive and provide keyboard operation and visible focus.
- Store prose as Markdown and execution details as structured run data. Agents must not generate JSX or HTML to request a component. Raw logs remain literal text in code blocks.

## Examples

### Handover

````markdown
Fixed the save error when a task title is empty.

## Changes

- Validate `title` before saving in `src/server/task-store.ts`.
- Return a clear validation message to the caller.

## Verification

- `npm test`: passed.
- Manual browser check: not run.
````

### Feedback fields

The following are Markdown field values; the transport still serializes them as valid JSON.

**Question**

```markdown
Should the import replace existing tasks or keep both versions?

1. Replace matching tasks by `id`.
2. Keep both versions with new IDs.
```

**Recommendation**

```markdown
Replace matching tasks by `id` to avoid duplicates. Tasks absent from the import remain unchanged.
```

### External evidence

```markdown
Terminal output can sit inside a collapsible trace. [shadcn Terminal](https://ui.shadcn.com/docs/ai-elements/base/terminal)
```

## Review checklist

- The answer or decision is visible first, and each section adds useful information.
- Lists, code spans, fenced snippets, and inline citations render correctly in Markdown.
- Reported results match recorded evidence; material limitations remain visible.
- Feedback retains valid JSON with Markdown string values.
- UI changes follow `docs/design-guidelines.md`, including shared variants, accessibility, Storybook examples, and verification.

## Feedback controls

Agents use the `todai_artifacts.request_feedback` MCP tool to request Human feedback.
Set `responseType` to `approval` for a specific proposal with Approve and Reject buttons.
Set `responseType` to `text` when the agent needs a written answer.
Supply a nonempty `question` and `recommendation` in Markdown.
After the tool succeeds, stop work and end the run.
The selected answer is saved as `Approved` or `Rejected` and resumes the same agent.
A rejected proposal does not authorize changes.
Existing JSON feedback requests without `responseType` continue to use text feedback.
