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

Create components under `src/components/` and colocate their `*.stories.tsx` files. Storybook discovers these stories automatically. Documentation and accessibility addons are installed; the preview loads the app's global CSS and shared toast host, with no custom toolbar or story ordering.

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

## Notification standard

Use the shared `toast` and `notifyOperation` exports from `src/components/ui/toast.tsx` for all app notifications. Do not add inline save banners, progress messages, or success/error alerts that shift page or dialog content. Field validation stays beside its input; empty states and retry controls are content, not notifications.

The app layout and Storybook preview each mount one `Toaster`. Do not mount additional toasters in individual components. Use `notifyOperation` for an asynchronous action: it replaces loading feedback with success or error in the same toast and rethrows failures so the caller can preserve its draft. Notify at the interaction boundary once, not again in lower-level persistence functions. Errors remain until dismissed; success notifications expire after four seconds. Direct error toasts must use `duration: Infinity`. Loading toasts must be resolved or dismissed when work finishes. Component-scoped loading requests must dismiss their toast on unmount; submitted mutations report their result at app scope even if their initiating component unmounts.

See **Feedback / Toast** in Storybook for success, error, information, warning, loading, and asynchronous examples. Toasts overlay content without moving the board and keep notifications available while a dialog is open.

While a dialog is open, notification close buttons remain clickable without dismissing the dialog. Escape dismisses the latest non-loading notification first; a subsequent Escape closes the dialog.

## Column agents

Use the settings button beside a column heading to configure its agent name, Codex CLI model ID, effort, optional instructions, and sandbox permissions. Unconfigured columns show **No agent configured**. Each column owns its settings; tasks do not override them.

Settings are stored in the same SQLite database as tasks and survive reloads and app restarts. Saving settings does not start a run. Model IDs are entered explicitly because availability depends on your Codex account; configuration validates required fields and supported effort/permission choices, without making an agent call. Choose an effort supported by the selected model. Actual execution belongs to the next ticket.

The column agent stories cover saving/reopening, field validation, and retaining drafts after failed saves. Store tests cover persistence, updates isolated to a column, validation, and unchanged task state.
