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

`src/components/tasks/` contains sample data and reusable components. Shared task and agent models live in `src/domain/`. `TaskBoard` owns the session state and composes `TaskColumn`, `TaskCard`, and `TaskEditor` inside `AppShell`. Cards use `AgentStatus` for the color-coded status and running spinner.

`TaskCard` exposes edit and drag callbacks; `TaskColumn` exposes drop callbacks. `TaskEditor` is controlled through `open`, `onOpenChange`, `onSave`, and `onDelete`. `TaskBoard` accepts `initialTasks` to seed a new board instance.

Use `npm run typecheck` to check both app and story types, and `npm run build-storybook` to generate the static component explorer. The Storybook build compiles interaction checks; it does not execute them.

## Source organization

- `src/app/`: pages, layout, styles, and HTTP route handlers.
- `src/domain/`: task and agent types, defaults, and profile validation shared by the UI and server.
- `src/components/tasks/`: board, editors, settings, and colocated stories. Description editing and comment rendering have their own components.
- `src/components/ui/`: shared UI primitives and notification helpers.
- `src/hooks/`: browser behavior such as board animations.
- `src/lib/workspace-api.ts`: typed client requests for tasks, agents, columns, and workspace settings.
- `src/server/`: SQLite persistence and agent execution. `schema.ts` owns schema initialization and legacy migrations; `task-store.ts` owns transactional operations.

## Local persistence

Use Node.js 24 or newer. The app creates `.todai/tasks.sqlite` in the project directory on first access. This ignored directory contains local workspace data; preserve it across restarts. Set `TODAI_DB_PATH` to use a different SQLite file. No sample tasks are inserted in the app.

Task placement is separate from agent execution: new tasks display **Queued** when their column has an assigned agent, and **Not started** otherwise, including in the Done column. Task details display persisted comments in chronological order. Manual comment creation is not included. Agent handovers and execution failures appear as ordinary comments.

Saves update the board after SQLite confirms them. A failed save keeps the editor open and retains the draft; retrying a new task uses the same ID. A failed move leaves the displayed board unchanged and offers retry or reload. Loading failures are displayed instead of an empty board.

Run `npm test` for SQLite persistence checks. These use temporary databases and cover create, edit, move, reopen, delete, and comment attachment/order. The Task editor stories include persisted comments and failed-save draft retention.

## Notification standard

Use the shared `toast` and `notifyOperation` exports from `src/components/ui/toast.tsx` for all app notifications. Do not add inline save banners, progress messages, or success/error alerts that shift page or dialog content. Field validation stays beside its input; empty states and retry controls are content, not notifications.

The app layout and Storybook preview each mount one `Toaster`. Do not mount additional toasters in individual components. Use `notifyOperation` for an asynchronous action: it replaces loading feedback with success or error in the same toast and rethrows failures so the caller can preserve its draft. Notify at the interaction boundary once, not again in lower-level persistence functions. Errors remain until dismissed; success notifications expire after four seconds. Direct error toasts must use `duration: Infinity`. Loading toasts must be resolved or dismissed when work finishes. Component-scoped loading requests must dismiss their toast on unmount; submitted mutations report their result at app scope even if their initiating component unmounts.

See **Feedback / Toast** in Storybook for success, error, information, warning, loading, and asynchronous examples. Toasts overlay content without moving the board and keep notifications available while a dialog is open.

While a dialog is open, notification close buttons remain clickable without dismissing the dialog. Escape dismisses the latest non-loading notification first; a subsequent Escape closes the dialog.

## Agents and column assignments

Open **Agents** in the sidebar to create, edit, or delete reusable agent profiles. Each profile contains a name, execution tool (Codex CLI), model, effort, optional instructions, and sandbox permissions. Model suggestions belong to the selected execution tool. The searchable input also accepts custom model IDs for that tool. Changing tools clears the model selection. Choose a model and effort supported by your Codex account.

On the board, use a column's settings button to select a saved agent or **No agent**. An assigned agent appears as a badge below the column heading. One profile can serve multiple columns; editing it updates all of those assignments. Removing an assignment keeps the profile available in Agents. Deleting a profile removes its assignments.

Profiles and assignments persist in SQLite. Existing per-column configurations migrate automatically into reusable profiles with their original assignments. Saving profiles or assignments does not start an agent run. Create a task in an assigned column or move an existing task into one to queue execution.

Store tests cover migration, profile validation, sharing, editing, unassignment, deletion, restart persistence, and unchanged task state. Storybook interactions cover the Agents screen, custom model entry, assignment/removal, and failed-save draft retention.

## Agent execution

In **Settings → Executor tools**, click **Test executor tools** to check Codex availability, sign-in, and a real shell command that reads a temporary test file. The test uses the CLI's default model and read-only sandbox, makes a small model request, and removes its temporary folder afterward. It does not create board tasks. Each check times out after 60 seconds. Failures stay in a dismissible toast with the failed step, available CLI diagnostics, and suggested next steps. This checks the executor independently of individual agent profiles and the selected workspace.

Install Codex CLI and sign in before running Todai. Open **Settings → Workspace** to select an existing directory where agents will work. Type a path to see directory suggestions, including `~/` for your home folder; add a trailing `/` to browse its subdirectories. Save the selection to persist it in SQLite. The saved setting is the only workspace configuration; there is no workspace environment variable. Existing installations default to the ignored `workspace/` directory until a directory is selected.

SQLite stays in `.todai/tasks.sqlite`, independently configurable with `TODAI_DB_PATH`. Selecting a workspace does not move files or change the database. Active runs keep their current directory; subsequent runs (including already queued work) use the latest saved selection without restarting the app. Keep the app server running while agents work. This local scheduler is intended for a persistent Node.js process on macOS/Linux, not serverless hosting.

Creating a task in a column with an assigned agent, or moving an existing task into a different assigned column, queues one run. Retrying the same creation, saving a profile, reloading, and dropping into the same column do not start additional runs. Runs snapshot the profile at queue time and read task details and earlier comments when starting. Codex receives the selected model, effort, instructions, and sandbox permissions, with interactive approvals disabled. Directories without a Git repository are supported.

Only one run executes at a time; later runs wait in queue order. The board polls for statuses and comments every second. Success records a **Complete** state and a handover, without moving the task. Failures record a **Failed** state with details in a comment and allow the next run to start. Run history, timestamps, profile snapshots, and outcomes persist in SQLite. A restart marks abandoned work **Interrupted**, stops any surviving Codex process group before continuing the queue, and preserves workspace files. Completed and interrupted runs are never retried automatically.

Queued and running tasks can be moved by dragging their card or changing Status in the task editor. Moving a running task stops Codex and its child commands before any next run starts, preserves workspace files, and records an interruption comment naming the latest destination. Moving queued work replaces its pending run; rapid moves leave at most one queued run for the latest destination. A destination without an assigned agent starts no new work. Same-column drops leave execution unchanged. Deletion remains disabled while work is queued or running.

`npm test` covers queue ordering, profile snapshots, handover context, restart recovery, interruption ordering, rapid redirection, late completion, preserved workspace files, and launch/exit failures using temporary databases and controllable runners. **Tasks / Task board / Live execution** checks live handovers without losing an open editor draft.

## Markdown content

Task descriptions and comments render Markdown, including headings, emphasis, lists, links, block quotes, fenced code, tables, and task lists. Existing task descriptions display formatted Markdown by default. Click a description (or focus it and press Enter) to edit its source in a textarea. **Save** persists an existing task’s description and closes the inline editor; **Cancel** discards the description draft. New tasks show only the description textarea, with no separate description controls; the description is saved when the task is created. The original Markdown is stored and supplied to agents. Board cards show a compact formatted preview; open the task to follow links or read the full description.
