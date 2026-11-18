# Todai

A local task board for managing work with AI coding agents. Organize tasks, assign agents to columns, and follow their progress from one workspace.

Built with Next.js, React, TypeScript, Tailwind CSS, and SQLite.

## Features

- Drag-and-drop task board with customizable columns.
- Rich text task descriptions and human comments, with @agent mentions and ordered agent replies.
- Reusable Codex CLI and Claude Code profiles with tool-specific model, effort, instructions, and permissions.
- Queued agent execution with live status updates and persisted run history.
- Manual execution by default, with a Run button in each task and optional Auto-run on column entry.
- Optional auto-workflow to move tasks to the next column after a successful run.
- JSON import and export of agents, columns, and their assignments.
- Workspace artifact library for text, Markdown, file uploads, and external links.
- Local SQLite storage and a Storybook component explorer.

## Getting started

Requires Node.js 24 or newer and npm. Agent execution also requires Codex CLI or Claude Code installed and signed in on the machine running Todai. Claude Code requires version 2.1.259 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://127.0.0.1:3000).

1. In **Settings → Workspace**, select your workspace directory.
2. In **Settings → Executors**, check tool status, test connections, and choose a default executor for new agents.
3. In **Agents**, choose an executor, model, effort, and permissions.
4. Assign an agent through a column’s settings, then create or move a task into that column. Open the saved task and press **Run** to queue its agent.

Add another named workspace in **Settings → Workspace → Add workspace**, then switch using the sidebar selector. Each workspace has its own tasks, agents, columns, assignments, and default executor. Selection lives in the browser URL, so separate tabs can work independently. Switching clears unsaved drafts and leaves queued and active runs in their original directories.

Saved tasks can use a reusable single-step workflow. In the task’s **Workflow** tab, choose **Create workflow**, name it, select an existing agent, and enter step instructions. Save the workflow and task, then press **Run**. Workflows belong to their workspace and run without a column assignment. Edit a selected workflow to change future executions; each execution retains its original workflow and agent configuration.

Expand **Workflow executions** to inspect each attempt’s outcome, result, step instructions, and exact prompt supplied by Todai. Provider instructions and private reasoning are not included. Feedback resumes the same snapshotted step; stopping, failing, or interrupting preserves history. Comment replies remain separate. Workflow-backed tasks bypass column Auto-run and Auto-workflow; tasks without a workflow retain the legacy controls.

Task automation is opt-in. Enable **Auto-run** to start the assigned agent when a task enters a column. Enable **Auto-workflow** to move to the next column after a successful run; the next agent waits for **Run** unless Auto-run is also enabled. Save task edits before pressing Run.

New boards start with **To do**, **In progress**, **In review**, and **Done**. Customize them in **Settings → Board**.

In a task’s Comments section, write a rich text comment and type **@** to select agents. Comments without mentions stay as context. A lightweight intent agent selects which tagged agents are being asked to respond and orders their replies; agents mentioned only as context do not respond. For example, “@Reviewer what do you think of @Implementor's comment?” asks only Reviewer to reply. Each responding agent sees earlier responses. The intent agent uses the default executor with `gpt-6-luna` (Codex) or `haiku` (Claude), at low effort. If intent detection fails, no replies start; post the comment again to retry. Comment replies keep the task in its current column.

Saved task details open on **Overview**, with pending feedback, recommendations, and evidence first, or the description and latest result. **Workflow** shows execution status and run history; **Activity** keeps comments, feedback, and run-history access; **Artifacts** collects linked work and pinned comment revisions. Use the expand button for more room. Tabs and expansion preserve drafts and reading position. Open **Run history** in Workflow or Activity to inspect previous runs, their statuses, and saved summaries. The history refreshes while expanded.

The header’s execution indicator shows the active agent, task, and workspace, along with queued jobs across workspaces. **Stop current run** terminates the agent and its commands, preserves saved files and history, and pauses the queue across all workspaces. The pause survives app restarts. **Run again** on a stopped task requests a new run using saved work and history; **Resume queue** is a separate action. Other queued requests remain queued, and requests for a stopped task wait until you explicitly run it again.

To change a workspace directory, stop the running agent or use **Pause queue** in the header. Save the directory in **Settings → Workspace**, then choose **Resume queue**. If queued jobs still reference an old directory, confirm their new destinations; cancelling leaves the queue paused. Explicitly running a stopped task uses the current workspace directory.

Use **Archive this workspace** in Settings when it has no running or queued jobs. Archived workspaces leave the selector but retain their tasks, history, configuration, and files. Restore them from Settings; when no active workspaces remain, the app offers creation and restoration.

Agents run one at a time. Keep the server running while they work. Todai is designed for a persistent local Node.js process on macOS or Linux.

## Data and configuration

Data is stored in `.todai/tasks.sqlite`. Set `TODAI_DB_PATH` to use another database file. Preserve the database to keep your tasks, profiles, settings, and run history across restarts.

The agent workspace is configured separately in Settings. Configuration exports include selected agents, columns, and assignments; they do not include tasks or workspace paths.

Settings tabs can be linked directly with `/settings?tab=general`, `/settings?tab=workspaces`, `/settings?tab=board`, or `/settings?tab=executors`.

Changing the default executor only affects new agent forms. Existing profiles and queued runs retain their executor. Codex sandbox modes and Claude permission modes have different meanings; the agent editor shows the available choices for each tool. Claude runs deny unresolved permission prompts and report denied actions as failures. Connection tests make a small model request; refreshing installation and sign-in status does not.

## Artifacts

Open **Artifacts** in the sidebar. **Create artifact** opens a document modal; its adjacent dropdown offers **Document** and **Image**. Documents use the same rich-text Markdown editor as task descriptions. Images accept PNG, JPEG, GIF, WebP, AVIF, and BMP uploads. Plain text and Markdown are grouped as documents. Search the workspace collection and filter by type or creator. Existing files and external links remain available, and agents can still publish them. Creator names are descriptive labels entered by the publisher.

Stored content is limited to **20 MiB per revision** and downloaded using its artifact ID. Content and metadata are published atomically in the application database alongside tasks, so backing up `.todai/tasks.sqlite` (or `TODAI_DB_PATH`) also preserves artifacts. Uploading copies the bytes: moving, editing, or deleting the original file does not affect the artifact. External links store only their URL and metadata; remote content can change.

Use **Publish revision** to update an artifact without changing its identity. Each publication retains its own author, timestamp, metadata, and stored bytes. **Revision history** lists earlier publications and downloads their exact content. External-link revisions preserve only the URL and metadata; upload a stored copy to preserve remote content.

**Archive** removes an artifact from normal discovery. Select **Archived artifacts** to find it again; all revisions and downloads remain available. Archival does not delete content. Concurrent publications receive distinct revision identities and remain in history.

In saved task details, use **Link artifact to task** to reuse a workspace artifact. Task links follow its latest revision. Choose the **paperclip** while composing a comment to pin the selected revision. Removing a task link keeps comment attachments intact; deleting a task preserves the artifacts. Task details group all references into one card per artifact and identify each comment source. Use **Linked task** in the library to filter by either kind of reference, including the archived view.

Type **#** in the comment editor to search workspace artifacts and insert a titled citation at the cursor. Citations pin the revision selected, even if a newer revision is published before you post. Hover or focus a saved citation for its title, type, and pinned revision. Click it to preview that revision and access its download or external URL; archived artifacts remain accessible. Agents can use the same Markdown form: `[Artifact title](#artifact/ARTIFACT_ID/REVISION_ID)`. Repeated citations share one tracked association per comment and revision.

Open an artifact to preview its exact revision inside Todai. Text and Markdown are readable, raster images display inline, and PDFs have page controls. PDF pages render with [PDF.js](https://mozilla.github.io/pdf.js/examples/) without document scripts or interactive forms. Unsupported files (including HTML, SVG, and Office documents) offer metadata and downloads. External links show metadata and an explicit navigation action; they do not embed remote pages. Empty, unavailable, or damaged content has an explanatory state, with downloads available for stored files.

During a run, Codex and Claude receive the same workspace-scoped artifact tools automatically. Agents can publish text, Markdown, file bytes (base64), and external links; publish new revisions; search and read artifacts; and link or unlink the current task. Only current-task metadata is included in the starting prompt. Published revisions record their task and run provenance and appear in the library immediately.

Agents can nominate exact revisions for their final handover or feedback request. Those attachments are saved atomically with the comment and deduplicated with inline citations. Tools expire when execution ends or is interrupted. Published work survives failure or interruption; nominations are not attached to failure or interruption notices. The tools cannot archive artifacts or choose a different workspace, task, creator, or run.

## Development

```sh
npm run lint             # ESLint
npm run typecheck        # App and Storybook types
npm test                 # Server tests using temporary databases
npm run storybook        # Component explorer on port 6006
npm run build-storybook  # Static component explorer
```

To run a production build locally:

```sh
npm run build
npm start
```

Shared styling conventions and component usage are documented in Storybook under **Foundations → Component styling** ([source](src/components/ui/style-guide.mdx)). Use its light/dark theme toolbar when reviewing components and dialogs.

## Project structure

- `src/app/` — pages and API routes.
- `src/components/` — UI components and Storybook stories.
- `src/domain/` — shared models and validation.
- `src/lib/` — client API and utilities.
- `src/server/` — persistence, agent execution, and tests.

## Contributing

Keep changes focused, add tests for new behavior, and run lint, type checks, and tests before opening a pull request.

### Ordered task workflows

In a task’s **Workflow** tab, create or edit a reusable workflow. Add agent steps, set instructions for each step, and use the up/down controls to order them. Steps connect automatically and execute from top to bottom. Save the workflow and task selection, then **Run** to start a new execution.

Successful steps advance exactly once. The Workflow tab shows persisted step progress, configuration snapshots, supplied prompts, attempts, and results. Failed, interrupted, or stopped executions stay paused. **Retry current step** continues the latest execution using its original configuration and existing workspace files; it preserves completed steps and does not roll back files. **Run** starts a new execution from the beginning. After a server restart, abandoned running steps become interrupted and require explicit retry. Resuming a paused queue alone does not restart stopped tasks; retrying a task does not resume the queue.

### Human approval checkpoints

Use **Add human checkpoint** in the workflow editor and describe what needs review. Checkpoints can appear before, between, or after agent steps. Reaching one saves a waiting state without starting another agent. In **Overview**, inspect the question, the preceding result, and its pinned artifact revisions. **View evidence in Activity** opens the original handover.

Choose **Approve** to continue once, or enter feedback and choose **Request changes** to keep waiting. Requesting changes records your response and opens a fresh decision; it does not automatically run a revision agent or return to an earlier step. Resolve the changes before approving, or stop the workflow and revise it. **Retry current step** reopens a stopped checkpoint using its saved instructions. Queue pause remains a separate control.

Agent questions still use **Submit feedback** and resume the agent step that asked. Activity retains workflow requests, human responses, decisions, and their execution/step references. These records and checkpoint evidence cannot be individually deleted. Waiting states and responses survive restarts; old or duplicate answers cannot advance a later execution.

### Bounded review and revision

Choose **Add review section** in the workflow editor, select reviewer and revision agents, and enter their instructions. The round limit defaults to three. The section repeats **Review → Changes requested → Revise → Review** and exits only on explicit approval.

Reviewers must return JSON with an `outcome` of `approved` or `changes-requested` and a nonempty `findings` string. A successful process exit or ordinary handover is never approval. Invalid output pauses as a failed attempt for explicit retry. Each queued reviewer attempt, including retries and feedback continuations, counts as a round.

At the limit, the workflow waits before running another revision. In **Overview**, choose **Allow one additional round** or **Stop workflow**. An additional round authorizes a revision followed by another review; it does not approve the work or resume a paused queue. Retrying a stopped intervention reopens the same decision.

The task summary and **Workflow** tab show the current step and round. Execution history retains reviewer outcomes, findings, reviewed attempts, and pinned evidence revisions. Failure, cancellation, feedback, and restart recovery retain the section position and original agent settings.
