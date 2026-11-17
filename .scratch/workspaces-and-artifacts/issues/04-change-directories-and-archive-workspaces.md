# 04: Support safe workspace directory changes and archival

**What to build:** Let people pause execution, change a workspace directory, and resume deliberately through a simple flow. Allow idle workspaces to be archived and restored while preserving their data.

**Blocked by:** 02 — Add workspace creation and sidebar switching; 03 — Stop tasks and pause global execution.

**Status:** complete

- [x] Directory edits are blocked while an agent is running. With the global queue paused and execution idle, a directory may be changed even when that workspace has queued jobs.
- [x] Saving a directory change does not resume execution or automatically restart stopped tasks.
- [x] Before queue resume, one concise confirmation updates affected queued jobs to the workspace's new directory. Declining leaves execution paused; stale jobs never silently run against the old directory.
- [x] Explicitly restarting a stopped task uses its workspace's current directory.
- [x] Settings can archive a workspace only when it has no running or queued jobs; archival does not silently cancel work.
- [x] Archived workspaces disappear from the normal selector and can be restored in Settings. Archiving the selected or last workspace leaves a valid selection or usable empty state.
- [x] Archival preserves tasks, history, configuration, and artifact ownership and never deletes the underlying working directory.
- [x] The global activity popover identifies the active workspace independently of the selected view.
- [x] Checks cover stop, directory edit, confirmation, and resume as one flow, plus archival and restoration without data loss.


## Verification

- TaskStore and ExecutionService checks cover stop, directory edit, confirmation, resume, and explicit restart using the current directory.
- HTTP checks reject running edits, unpaused queued edits, missing/stale confirmations, and archival with pending work.
- Archive/restore checks preserve board, configuration, history, and directory; the last workspace can be restored through the global registry.
- All 113 server tests pass. Typechecking and the Storybook build pass; lint has no errors and one existing character-counter warning.
- Standards and spec reviews have no remaining findings. Browser interaction verification was unavailable because the browser host could not be reached.
