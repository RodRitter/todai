# AI Elements fit for Todai

Reviewed 18 November 2026 against the current official docs and repository source. This is an assessment, not an implementation proposal to adopt every pattern.

## Recommendation

Keep the board and task discussion model. Adopt selected presentation patterns inside those surfaces. The most useful immediate candidates are Message presentation and artifact citation/attachment refinements. The biggest functional improvement would be a Trace-based run history and execution queue view, which needs additional API data. Rich tool timelines should follow a separate executor-event integration.

## Compatibility

The current [AI Elements docs](https://ui.shadcn.com/docs/ai-elements) describe copyable compositions of shadcn/ui primitives, rather than a single AI Elements runtime package. The examples offer Base UI, React Aria and Radix variants. Todai already uses React 19, Tailwind 4, Radix and local shadcn components; use the Radix variants and adapt their styling to existing shared components. Individual primitives can still introduce dependencies: copying a pattern does not mean it is dependency-free.

Todai does not use Vercel AI SDK. Several interactive demos use `useChat`, but presentation patterns can be adapted to Todai's own domain types. Do not introduce AI SDK or replace the CLI execution layer just to render these patterns. Sources: [package.json](../package.json), [components.json](../components.json), [Tool demo](https://ui.shadcn.com/docs/ai-elements/base/tool).

## Candidates

| Pattern | Fit and proposed use | Required work |
| --- | --- | --- |
| [Message](https://ui.shadcn.com/docs/ai-elements/radix/message) | Good presentation reference for agent handovers and human comments: clearer body/action grouping and consistent formatting. | Adapt inside `TaskComments`; retain author names, timestamps, deletion rules, feedback states, document attachments and newest-first ordering. It models a conversation turn, whereas Todai has multiple named agents, so avoid assuming every human comment has exactly one reply. |
| [Inline Citation](https://ui.shadcn.com/docs/ai-elements/radix/inline-citation) and attachment treatment in [Prompt Input](https://ui.shadcn.com/docs/ai-elements/base/prompt-input) | Useful polish for existing `#artifact` citations and attachment chips. A citation preview could show title and type before opening the existing viewer. | Preserve artifact identity, archived access, click and keyboard access; a hover card is supplementary. Existing artifact preview functionality already covers much of the need. |
| [Trace](https://ui.shadcn.com/docs/components/base/trace) | Strongest building block for a compact per-task run history: queued, running, waiting for feedback, failed, stopped, completed, with details on expansion. Trace supports icon/title/status lines and collapsible details. | Expose persisted run records to the client and map real statuses. Start with coarse run history, not simulated tool activity. |
| [Queue](https://ui.shadcn.com/docs/ai-elements/radix/queue) | Borrow its compact grouping for jobs waiting behind the active run in the header execution popover. | The documented pattern is an agent's todo list, not a job scheduler. Adapt the visual idea to actual queued runs; extend `ExecutionState`, which currently exposes only the active job, pause state and directory-change confirmations. Keep cross-workspace pause/stop semantics explicit. |
| [Tool](https://ui.shadcn.com/docs/ai-elements/base/tool), [Plan](https://ui.shadcn.com/docs/ai-elements/radix/plan), Terminal and Test Results | High-value later for an expandable activity panel under a run. Tool handles output/errors; Plan handles known steps and progress. | Normalize and persist structured events from both executors, then expose incremental updates. Current runners return final handovers rather than UI-consumable tool or plan events. Do not infer a structured test result or plan from arbitrary prose. |
| [Questionnaire](https://ui.shadcn.com/docs/components/radix/questionnaire) | Potential fit for richer human feedback: options, multiple questions and freeform alternatives. | Existing feedback contains a question and recommendation plus a freeform answer, so a full questionnaire needs an extended feedback schema, persistence and resume mapping. Keep the current simple form until those capabilities are wanted. |
| [Confirmation](https://ui.shadcn.com/docs/ai-elements/radix/confirmation) | Useful only if Todai gains true per-tool approval and resume. It is a yes/no tool gate, not a generic feedback component. | Current Codex runs use approval policy `never`; Claude disables permission prompts and treats permission denials as failures. Adding Approve/Deny buttons alone would misrepresent execution capabilities. |

## Keep or defer

- **Prompt Input:** borrow attachment/action layout selectively. The stock textarea would discard Todai's Tiptap formatting, `@agent` mentions and `#artifact` citations. The repo's [style guide](../src/components/ui/style-guide.mdx) requires `DescriptionEditor` for rich text and `TaskComments` for discussions.
- **Chat / Message Scroller:** [Chat](https://ui.shadcn.com/docs/ai-elements/base/chat) anchors a human question while a response streams below it. Todai currently displays completed comments newest-first. Consider scrolling primitives only if a chronological live conversation is deliberately introduced; do not reverse the discussion just to fit a demo.
- **Model Selector:** [the pattern](https://ui.shadcn.com/docs/ai-elements/radix/model-selector) uses model and effort menus. Todai's [agent editor](../src/components/tasks/agent-editor.tsx) already has executor-specific choices and a model combobox supporting custom IDs. A second selector in the comment composer would obscure which profile the mentioned agent uses. Low priority.
- **Reasoning / Chain of Thought:** [Reasoning](https://ui.shadcn.com/docs/ai-elements/radix/reasoning) expects streaming reasoning content. The current runners do not expose it. Prefer factual execution summaries; only render summaries actually supplied by a future executor integration.
- **Context, Checkpoint, Subagent, File Tree:** defer until reliable context usage, restoration, delegated-run or file-change data exists. A generic “restore checkpoint” action would be particularly misleading without actual workspace restoration.
- **Sources and Suggestion:** add when there is a concrete source collection or useful task-specific suggested action. Todai already has artifact citations and explicit Run controls; generic chat prompts add little to this workflow.

## Suggested order

1. Refine existing comment presentation and artifact references, preserving behavior. Review the existing TaskComments and artifact stories in light/dark and narrow layouts.
2. Add run-history and queued-job API views, then render them with Trace-inspired rows. This would answer practical questions about what ran, what failed and what is waiting.
3. If live observability is desired, design a shared executor event model before adding Tool, Plan, Terminal or Test Results rendering.
4. Treat structured feedback and tool approvals as separate product/backend features, not component substitutions.

Local evidence: [task comments](../src/components/tasks/task-comments.tsx), [task types](../src/domain/task.ts), [execution types](../src/domain/execution.ts), [execution indicator](../src/components/execution-activity.tsx), [Codex runner](../src/server/codex-runner.ts), [Claude runner](../src/server/claude-runner.ts), [feedback protocol](../src/server/agent-prompt.ts), and [README](../README.md). Fit and prioritization judgments above are recommendations inferred from those sources and the linked official patterns. No application code or dependencies were changed.
