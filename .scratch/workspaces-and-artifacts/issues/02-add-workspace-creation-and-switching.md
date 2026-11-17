# 02: Add workspace creation and sidebar switching

**What to build:** Let people add workspaces in Settings and switch between them in the sidebar. Each workspace starts with default configuration and has its own board, agents, and settings; switching changes the view without affecting execution.

**Blocked by:** 01 — Introduce workspace ownership for existing data.

**Status:** complete

- [x] Settings supports adding a named workspace with a validated working directory.
- [x] New workspaces start with default configuration only; no configuration, tasks, or artifacts are copied from another workspace.
- [x] The sidebar clearly identifies the selected workspace and switches its board, agent profiles, columns, assignments, and default executor configuration together.
- [x] File references, skills, and directory-dependent views resolve against the explicitly selected workspace.
- [x] Switching remains available during execution and neither cancels work nor changes the directory of queued or active jobs.
- [x] Polling, drafts, and late responses cannot display or save one workspace's data into another. Separate browser views cannot redirect each other's mutations.
- [x] Configuration import/export operates on the intended workspace without altering others.
- [x] End-to-end checks demonstrate two independent workspaces, including identical column names and switching while work is active.


## Verification

- Workspace HTTP creation test checks invalid inputs, canonical directory, empty board, default columns and executor, and preservation of the original workspace.
- Client API regression proves the URL-selected workspace stays bound to requests even when the URL changes before a response arrives.
- Existing ownership tests cover matching column names, configuration import isolation, foreign references, and globally serial execution with captured directories.
- Chrome check using an isolated database: created Second project through Settings, switched between two default boards, confirmed original agent/task stayed isolated, and confirmed an unsaved Settings draft cleared on switching.
- A controlled ExecutionService runner remained Running after switching away and back, then completed in its captured original directory. No production data was used.
