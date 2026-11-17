# 04: Support safe workspace directory changes and archival

**What to build:** Let people pause execution, change a workspace directory, and resume deliberately through a simple flow. Allow idle workspaces to be archived and restored while preserving their data.

**Blocked by:** 02 — Add workspace creation and sidebar switching; 03 — Stop tasks and pause global execution.

**Status:** ready-for-agent

- [ ] Directory edits are blocked while an agent is running. With the global queue paused and execution idle, a directory may be changed even when that workspace has queued jobs.
- [ ] Saving a directory change does not resume execution or automatically restart stopped tasks.
- [ ] Before queue resume, one concise confirmation updates affected queued jobs to the workspace's new directory. Declining leaves execution paused; stale jobs never silently run against the old directory.
- [ ] Explicitly restarting a stopped task uses its workspace's current directory.
- [ ] Settings can archive a workspace only when it has no running or queued jobs; archival does not silently cancel work.
- [ ] Archived workspaces disappear from the normal selector and can be restored in Settings. Archiving the selected or last workspace leaves a valid selection or usable empty state.
- [ ] Archival preserves tasks, history, configuration, and artifact ownership and never deletes the underlying working directory.
- [ ] The global activity popover identifies the active workspace independently of the selected view.
- [ ] Checks cover stop, directory edit, confirmation, and resume as one flow, plus archival and restoration without data loss.

