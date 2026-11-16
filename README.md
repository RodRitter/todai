# Todai

A local task board for managing work with AI coding agents. Organize tasks, assign agents to columns, and follow their progress from one workspace.

Built with Next.js, React, TypeScript, Tailwind CSS, and SQLite.

## Features

- Drag-and-drop task board with customizable columns.
- Markdown task descriptions and agent handover comments.
- Reusable Codex agent profiles with model, effort, instructions, and sandbox settings.
- Queued agent execution with live status updates and persisted run history.
- Optional auto-workflow to move tasks to the next column after a successful run.
- JSON import and export of agents, columns, and their assignments.
- Local SQLite storage and a Storybook component explorer.

## Getting started

Requires Node.js 24 or newer and npm. Agent execution also requires Codex CLI installed and signed in on the machine running Todai.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://127.0.0.1:3000).

1. In **Settings → General**, select your workspace directory and test the executor tools.
2. In **Agents**, create a profile with your preferred model and permissions.
3. Use a column’s settings button to assign an agent.
4. Create a task in that column, or move a task into it, to queue a run.

New boards start with **To do**, **In progress**, **In review**, and **Done**. Customize them in **Settings → Board**.

Agents run one at a time. Keep the server running while they work. Todai is designed for a persistent local Node.js process on macOS or Linux.

## Data and configuration

Data is stored in `.todai/tasks.sqlite`. Set `TODAI_DB_PATH` to use another database file. Preserve the database to keep your tasks, profiles, settings, and run history across restarts.

The agent workspace is configured separately in Settings. Configuration exports include selected agents, columns, and assignments; they do not include tasks or workspace paths.

Settings tabs can be linked directly with `/settings?tab=general` or `/settings?tab=board`.

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

## Project structure

- `src/app/` — pages and API routes.
- `src/components/` — UI components and Storybook stories.
- `src/domain/` — shared models and validation.
- `src/lib/` — client API and utilities.
- `src/server/` — persistence, agent execution, and tests.

## Contributing

Keep changes focused, add tests for new behavior, and run lint, type checks, and tests before opening a pull request.
