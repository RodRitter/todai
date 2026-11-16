# Todai

A local task-board prototype built with Next.js, TypeScript, Tailwind CSS, and shadcn components. The `/` route and Storybook use the same reusable task components. The app persists tasks, column placement, and comments in local SQLite. Storybook examples keep their state in memory.

## Getting started

Use Node.js 24 LTS (`nvm use`) and npm.

```sh
npm ci
npm run storybook
```

Open http://127.0.0.1:6006 for Storybook. Explore **Tasks** for agent statuses, cards, columns, the editor, and the interactive board, or **Layout** for the app shell. Stories include empty, dragging, long-description, and modal states, plus interaction checks that run when their stories are opened.

```sh
npm run dev             # Task board on http://127.0.0.1:3000
npm run lint
npm run typecheck       # App, stories, and Storybook configuration
npm run typecheck:app   # App only, excluding stories
npm run build
npm run start           # Serves an existing production build
npm run build-storybook # Static Storybook in storybook-static/
```

## Adding components

Create components under `src/components/` and colocate their `*.stories.tsx` files. Storybook discovers these stories automatically. Documentation and accessibility addons are installed; the preview loads the app's global CSS with no custom decorators, toolbar, or story ordering.

The shadcn configuration in `components.json`, theme tokens in `src/app/globals.css`, and `cn` helper in `src/lib/utils.ts` remain available as a foundation for new components.

## Task components

`src/components/tasks/` contains the shared task types, sample data, and reusable components. `TaskBoard` owns the session state and composes `TaskColumn`, `TaskCard`, and `TaskEditor` inside `AppShell`. Cards use `AgentStatus` for the color-coded status and running spinner.

`TaskCard` exposes edit and drag callbacks; `TaskColumn` exposes drop callbacks. `TaskEditor` is controlled through `open`, `onOpenChange`, `onSave`, and `onDelete`. `TaskBoard` accepts `initialTasks` to seed a new board instance.

Use `npm run typecheck` to check both app and story types, and `npm run build-storybook` to generate the static component explorer. The Storybook build compiles interaction checks; it does not execute them.

## Local persistence

Use Node.js 24 or newer. The app creates `.todai/tasks.sqlite` in the project directory on first access. This ignored directory contains local workspace data; preserve it across restarts. Set `TODAI_DB_PATH` to use a different SQLite file. No sample tasks are inserted in the app.

Task placement is separate from agent execution: new tasks display **Not started**, including in the Done column. Task details display persisted comments in chronological order. Manual comment creation and agent execution belong to later tickets.

Saves update the board after SQLite confirms them. A failed save keeps the editor open and retains the draft; retrying a new task uses the same ID. A failed move leaves the displayed board unchanged and offers retry or reload. Loading failures are displayed instead of an empty board.

Run `npm test` for SQLite persistence checks. These use temporary databases and cover create, edit, move, reopen, delete, and comment attachment/order. The Task editor stories include persisted comments and failed-save draft retention.
