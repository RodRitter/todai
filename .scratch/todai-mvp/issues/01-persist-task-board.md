# 01: Persist the task board

**What to build:** Turn the existing board into a persistent local task board for one project workspace. Users can create, edit, delete, and move tasks, reopen the app, and find their saved work. Task details show ordinary comments that will later carry agent handovers. Reuse the existing board and editor; keep the existing columns and avoid adding workspace management or custom goal and acceptance-criteria fields.

**Blocked by:** None (can start immediately).

**Status:** complete

- [x] Reuse existing shared components wherever possible, following their Storybook stories as usage examples for composition, variants, and interaction patterns. Extend existing components when needed instead of duplicating them; add or update relevant stories for new or changed UI states.
- [x] Users can create a task with a description, edit it, delete it, and move it between existing columns through the board.
- [x] Tasks and their column placement are stored in local SQLite and survive page reloads and app restarts; deleted tasks do not return.
- [x] Task details display persisted ordinary comments in chronological order, with an understandable empty state. Manual comment authoring is not required for this slice.
- [x] Board placement and agent execution status are separate concepts. Tasks without a run do not misleadingly appear to be running or complete.
- [x] Failed saves are visible to the user and do not silently present unsaved changes as persisted.
- [x] Verify the create, edit, move, reload, restart, and delete flow against SQLite; verify that a persisted comment remains attached to the correct task.

Implementation uses `.todai/tasks.sqlite` (override with `TODAI_DB_PATH`). Verified with temporary SQLite store tests, browser create/edit/move/reload/delete, and a production-process restart retaining a task and its comment. Failed-save, retry, cancellation, and comment states are covered by Storybook interactions.
