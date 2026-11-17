# 01: Introduce workspace ownership for existing data

**What to build:** Give existing Todai data a durable workspace identity. Existing users retain their board and history in an initial workspace derived from their configured working directory. Execution and requests use explicit ownership rather than whichever workspace happens to be selected.

**Blocked by:** None (can start immediately).

**Status:** complete

- [x] Existing tasks, runs, agent profiles, columns, assignments, and default executor configuration migrate into one initial workspace without losing history or changing current board behavior.
- [x] Workspace identity is independent of its display name and directory. CLI installation and authentication remain machine-wide.
- [x] Workspace-scoped reads and mutations identify their target workspace explicitly and reject mismatched task, run, or configuration references.
- [x] Jobs capture workspace identity and directory when enqueued; execution never resolves their directory from the currently selected view.
- [x] Existing queued jobs receive initial-workspace ownership during migration. Existing execution remains globally serial.
- [x] Identically named columns can exist in different workspaces without sharing assignments or task state.
- [x] Migration and isolation checks cover existing history, repeated startup, and requests with mismatched workspace ownership.

