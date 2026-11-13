# Todai: lean MVP implementation plan

## Objective

Build a local task manager for LLM agent work. Users create projects pointing to local workspaces, configure agents, and assign tasks to either a reusable workflow or a single agent. Todai automatically runs the agent assigned to the task's current step and moves the task according to the result.

Prioritize one working end-to-end path and a small, understandable codebase. This document is the implementation handoff; build the MVP described here before expanding its scope.

## Current component foundation

The first bootstrap is limited to Next.js and a small shadcn/ui design system. Develop primitives in Storybook with the standard New York style, neutral theme, and stock component behavior. Keep custom design overrides for a later pass.

The initial primitives are Button, Badge, Input, Textarea, Label, Checkbox, Switch, Alert, Progress, Skeleton, Separator, Tabs, and Dialog, with colocated stories for their relevant variants and states. Both the application and Storybook load `src/app/globals.css`; `components.json` records the shadcn configuration.

No product layouts or screens are part of this bootstrap. The empty app route is intentional. This does not complete the local foundation milestone below, which also requires persistence and runtime work. See [the README](../README.md) for development commands and verification limitations.

## Product decisions

- Next.js, React, and TypeScript for the UI and local backend.
- SQLite for persistent application data; local files for run logs.
- A small Node worker executes agent processes independently of HTTP requests.
- One repository and one user-facing start command. No external database, queue service, Docker requirement, or application account system.
- Workflows belong to tasks, not projects. Tasks in one project can use different workflows.
- Single-agent tasks use the same execution mechanism as multi-step workflows.
- One active agent run globally. Work directly in the project's existing workspace.
- Everything Todai stores and coordinates is local. The selected agent CLI may still use its provider's hosted models and existing authentication.

## First-run experience

1. User clones Todai, runs `npm install`, then `npm run start`.
2. The start script initializes local storage, performs any required initial build, and launches the web app and worker. Document the supported Node version and expose a separate development command.
3. Setup detects a supported agent CLI and shows actionable guidance if it is missing or unauthenticated. Use the CLI's existing authentication; Todai does not collect provider credentials.
4. User creates a project with a name, existing absolute workspace path, and optional instructions. A text path input is sufficient.
5. User selects or edits bundled agent presets and a workflow template.
6. User creates a task, chooses a project and workflow or agent, and explicitly queues it.
7. Todai executes the steps and shows progress, logs, handoffs, and the final result.

Start with Codex as the first CLI integration. Verify its currently supported noninteractive invocation, output format, permission behavior, and cancellation behavior against installed CLI help and official documentation before implementing. Claude support is a follow-up, not an MVP completion requirement. Report a blocked integration honestly; a simulated runner alone is not a completed product.

## Domain model

Use a handful of SQLite tables and JSON columns for small configuration objects. Prefer direct queries and a small migration mechanism over a generic persistence framework.

| Entity | Minimum information |
| --- | --- |
| Project | ID, name, absolute workspace path, instructions |
| Agent | ID, name, instructions, selected bundled skills, supported runner configuration |
| Workflow | ID, name, ordered step definitions, initial step ID |
| Task | ID, project ID, title, description, workflow snapshot, current step ID, execution state, timestamps |
| Run | ID, task ID, step ID, resolved agent configuration, attempt number, state, timestamps, summary, outcome, error, log location |

A workflow step has a stable ID, name, type (`agent`, `manual`, or `done`), optional agent ID, overview category, and outcome-to-destination mapping. The ordered list controls display; explicit transitions control execution and allow review loops.

Task creation copies the workflow definition into the task. Editing a workflow affects new tasks. Workflow snapshots preserve agent references; resolve and record the agent configuration when each run starts. Agent edits therefore affect future runs, never an active run. Keep this behavior explicit in the UI. Editing a task's workflow after it is queued is outside the MVP.

For a single-agent task, create a private minimal snapshot with one automated Todo step whose `success` outcome leads to Done. The UI asks only for the agent.

## Workflow behavior

Ship this editable default template:

| Step | Agent | Outcomes |
| --- | --- | --- |
| Todo | Planner | `success` → Ready for dev |
| Ready for dev | Developer | `success` → Ready for review |
| Ready for review | Reviewer | `approved` → Done; `changes_requested` → Ready for dev |
| Done | None | Terminal |

Also support manual steps: no agent starts until the user selects one of that step's configured transitions. This provides human review without a separate approval subsystem.

Provide a simple form editor for workflow names, steps, agent assignments, and named outcomes. Validate unique step IDs, valid destinations, an initial step, required agent assignments, and a reachable Done step. Permit cycles. A visual graph builder is unnecessary.

Keep workflow position separate from execution state. Suggested task execution states are `draft`, `queued`, `running`, `waiting`, `blocked`, `failed`, `cancelled`, and `completed`.

- A new task is a draft until the user explicitly queues it.
- Entering an automated step queues exactly one attempt.
- Entering a manual step waits for the user; entering Done completes the task.
- An agent returns a structured summary and named outcome. Todai validates the outcome and applies the configured transition.
- A nonzero exit, missing result, or invalid outcome does not advance the task. Preserve the output and require an explicit retry.
- Support a blocked result carrying a reason; it waits for user intervention rather than advancing.
- Retry creates a new run for the same step and preserves earlier attempts.
- Cancellation stops the active child process and leaves the task in its current step. Retry is explicit.
- Disable manual movement during an active run. For idle tasks, expose configured transitions rather than arbitrary drag-and-drop.
- Pause after 10 automatic runs per task without human intervention and explain why. An explicit Continue action resets this counter.

The planner's plan, developer's implementation and validation notes, and reviewer's findings must survive each handoff. Build each run's input from the task request, project instructions, selected agent instructions and skills, and prior structured handoff summaries. Keep full logs available separately instead of repeatedly including them in prompts.

## Runtime architecture

Use three small areas in one repository: Next.js UI/routes, shared database/domain code, and the Node worker. Suggested directories are `src/app`, `src/lib`, `src/worker`, and `skills`. Keep runtime files in a gitignored `.todai/` directory anchored to the installation, independent of project workspaces.

The UI writes task changes through the backend. The worker polls SQLite for queued work. Polling at roughly one second is enough for both queue checks and UI updates; streaming infrastructure can wait.

The worker owns process lifecycle and transitions:

1. Atomically claim the next eligible task and create its run before launching a process.
2. Resolve the project workspace and agent configuration; persist the configuration used by the run.
3. Launch the CLI in that workspace with explicit arguments and composed instructions.
4. Append stdout/stderr to a run log while recording lifecycle state.
5. Validate the terminal result and atomically finalize the run and update the task.

Keep the runner interface small: start with input and workspace, receive output, obtain a structured result, and cancel. Implement only the real first provider and a deterministic fake for execution tests. Avoid building a plugin framework.

Use a worker ownership lock and atomic database claims to prevent duplicate execution, including accidental double startup. Configure SQLite for the web process and worker to share access with short transactions and bounded contention handling. On shutdown, stop accepting work and terminate owned child processes. On restart, reconcile unfinished runs as interrupted only after establishing that the previous worker/processes are no longer active; require manual retry. Do not silently rerun interrupted work.

Run logs should be readable incrementally or by bounded tail so polling does not repeatedly load entire files. UI cancellation requests should be persisted for the worker to handle.

## Skills and agent execution

Bundle a minimal planner, developer, and reviewer preset with corresponding readable Markdown skills. Skills describe working methods; the worker handles scheduling and state changes.

Pass selected skill content into run instructions using the provider's supported mechanism. Respect the target workspace's own agent instructions. Keep Todai metadata and result files outside the target repository where possible, and do not overwrite its instruction files.

Use existing CLI permission controls. If unattended execution cannot proceed under those controls, expose an actionable blocked state. Do not silently enable unrestricted execution to make the demo work. Automatic commits, pushes, and merges are outside scope.

Bind the application to localhost, validate workspace paths server-side, and invoke child processes with argument arrays rather than shell-interpolated task text. Reject cross-origin mutation requests. Local operation is not a sandbox for agent filesystem access.

## Minimal interface

Build functional, restrained screens:

- **Setup/settings:** CLI readiness and local runtime status.
- **Projects:** list, create, edit name/path/instructions.
- **Agents:** list and edit presets, instructions, and skill selection.
- **Workflows:** list and simple step/outcome editor.
- **Tasks:** create, filter by project/workflow, and view progress.
- **Task detail:** original request, current step, run history, handoff summaries, log tail, and relevant queue/retry/cancel/continue/manual-transition actions.

The project overview groups tasks into Todo, In progress, Needs attention, and Done while displaying the precise workflow step. Drafts appear in Todo; blocked, failed, interrupted, and cancelled work appears in Needs attention. Otherwise use the step's overview category, with Done terminal.

A workflow-filtered board can show actual workflow columns. Because tasks retain snapshots, group boards by identical workflow snapshot; fall back to the overview/list when definitions differ. A simple list grouped by step is acceptable for the MVP. Drag-and-drop is optional and should not delay execution functionality.

## Implementation sequence and completion criteria

### 1. Local foundation

Create the Next.js application, SQLite schema/migrations, local storage paths, and combined start script. Add project creation and CLI readiness checks.

Complete when a fresh install starts with the documented commands and a project survives an application restart.

### 2. One real single-agent task

Implement agent configuration, draft/queue actions, atomic task claiming, the first CLI runner, persisted logs/results, and task detail. Add cancellation, manual retry, and interrupted-run handling before chaining agents.

Complete when a real task modifies a file in a disposable project workspace, Todai displays the result, and retry/cancellation preserve run history.

### 3. Workflow execution

Add the workflow editor, task snapshots, named outcomes, manual steps, prior-summary handoffs, and automatic transition limit. Seed the planner/developer/reviewer workflow.

Complete when tasks in one project can independently use a single agent and a multi-step workflow, including a reviewer sending work back to development.

### 4. Usable overview and onboarding

Finish project/task filtering, overview grouping, agent/workflow editing, startup diagnostics, and a short README covering installation, execution permissions, data location, and recovery.

Complete when a user can configure and run the core flow entirely through the UI after installing/authenticating the supported CLI.

## Verification

Use focused automated tests for the behavior that can cause duplicate work or incorrect handoffs:

- Atomic claims prevent two workers from starting the same task and enforce global concurrency of one.
- Valid outcomes advance exactly once; failures and malformed results do not advance.
- Single-agent and multi-step tasks coexist in the same project.
- Workflow edits leave existing snapshots unchanged.
- Manual steps pause, retries create fresh attempts, and review loops hit the automatic-run limit.
- Cancellation and restart reconciliation preserve history without automatically repeating work.

Use a deterministic fake runner for these tests. Run type checking, applicable lint/build checks, and one real CLI smoke test in a disposable workspace. Record any unavailable verification explicitly.

## Scope boundary

Defer multiple providers, concurrent execution, git worktrees, automatic merges, cloud hosting, remote workers, multi-user accounts, scheduling, notifications, workflow graph canvases, task dependencies, dynamic agent delegation, and skill marketplaces.

The MVP is complete when a user can start Todai locally, register a workspace, configure an agent and workflow, queue tasks using different processes, watch automatic handoffs, and recover from a failed run without losing history. Prefer the smallest implementation that meets those observable behaviors.
