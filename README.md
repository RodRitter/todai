# TODO

[ ] Add multi-workspace selector
[ ] Artifacts, documents and storage
[x] Queries, feedback & answers in comments

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
- Local SQLite storage and a Storybook component explorer.

## Getting started

Requires Node.js 24 or newer and npm. Agent execution also requires Codex CLI or Claude Code installed and signed in on the machine running Todai. Claude Code requires version 2.1.259 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://127.0.0.1:3000).

1. In **Settings → Workspaces**, select your workspace directory.
2. In **Settings → Executors**, check tool status, test connections, and choose a default executor for new agents.
3. In **Agents**, choose an executor, model, effort, and permissions.
4. Assign an agent through a column’s settings, then create or move a task into that column. Open the saved task and press **Run** to queue its agent.


Add another named workspace in **Settings → Workspaces → Add workspace**, then switch using the sidebar selector. Each workspace has its own tasks, agents, columns, assignments, and default executor. Selection lives in the browser URL, so separate tabs can work independently. Switching clears unsaved drafts and leaves queued and active runs in their original directories.

Task automation is opt-in. Enable **Auto-run** to start the assigned agent when a task enters a column. Enable **Auto-workflow** to move to the next column after a successful run; the next agent waits for **Run** unless Auto-run is also enabled. Save task edits before pressing Run.

New boards start with **To do**, **In progress**, **In review**, and **Done**. Customize them in **Settings → Board**.

In a task’s Comments section, write a rich text comment and type **@** to select agents. Comments without mentions stay as context. A lightweight intent agent selects which tagged agents are being asked to respond and orders their replies; agents mentioned only as context do not respond. For example, “@Reviewer what do you think of @Implementor's comment?” asks only Reviewer to reply. Each responding agent sees earlier responses. The intent agent uses the default executor with `gpt-6-luna` (Codex) or `haiku` (Claude), at low effort. If intent detection fails, no replies start; post the comment again to retry. Comment replies keep the task in its current column.

The header’s execution indicator shows the active agent, task, and workspace. **Stop current run** terminates the agent and its commands, preserves saved files and history, and pauses the queue across all workspaces. The pause survives app restarts. **Run again** on a stopped task requests a new run using saved work and history; **Resume queue** is a separate action. Other queued requests remain queued, and requests for a stopped task wait until you explicitly run it again.

Agents run one at a time. Keep the server running while they work. Todai is designed for a persistent local Node.js process on macOS or Linux.

## Data and configuration

Data is stored in `.todai/tasks.sqlite`. Set `TODAI_DB_PATH` to use another database file. Preserve the database to keep your tasks, profiles, settings, and run history across restarts.

The agent workspace is configured separately in Settings. Configuration exports include selected agents, columns, and assignments; they do not include tasks or workspace paths.

Settings tabs can be linked directly with `/settings?tab=general`, `/settings?tab=workspaces`, `/settings?tab=board`, or `/settings?tab=executors`.

Changing the default executor only affects new agent forms. Existing profiles and queued runs retain their executor. Codex sandbox modes and Claude permission modes have different meanings; the agent editor shows the available choices for each tool. Claude runs deny unresolved permission prompts and report denied actions as failures. Connection tests make a small model request; refreshing installation and sign-in status does not.

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
