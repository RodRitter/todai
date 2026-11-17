# 03: Stop tasks and pause global execution

**What to build:** Provide a subtle global-header activity indicator with a popover showing the active agent and task, plus a Stop current run action. Stopping makes execution stay idle so the user can make changes without repeatedly stopping agents.

**Blocked by:** None (can start immediately).

**Status:** complete

- [x] The header distinguishes running from idle or paused execution. Its popover shows the active agent and task, and workspace information when workspace ownership is available.
- [x] Stop current run forcefully terminates the active agent process group and marks its task Stopped.
- [x] The stop operation pauses the global queue before another job can be claimed. Late completion events cannot mark the stopped task successful or trigger another workflow step.
- [x] No automatic workflow transitions or follow-on runs occur for the stopped execution. Other queued jobs remain queued.
- [x] Published artifacts, comments, and workspace filesystem changes are preserved; stopping performs no rollback.
- [x] Queue pause survives reload or application restart. Switching views or changing settings does not resume it.
- [x] Resuming a stopped task explicitly requests a new run using its history and saved work; it does not imply restoring a suspended process or unpausing the queue.
- [x] Queue resume is a separate explicit action. A stopped task remains stopped unless explicitly restarted.
- [x] Checks cover stop/completion races, child-process termination, queue persistence, and prevention of automatic workflow triggers.


## Verification

- ExecutionService and TaskStore regressions cover late completion, preserved queued requests, stop persistence, independent queue resume, explicit fresh runs with history, and stopped tasks staying stopped across edits and moves.
- Real CLI process-group checks prove both the agent and child commands terminate while workspace files remain intact.
- Global HTTP tests cover cross-workspace visibility, stale run IDs, input validation, and orphan termination after an application restart from a settings-only session.
- Storybook covers running, idle, paused, stopping, unavailable, error, long-content, and interactive Stop/Resume states.
- Typechecking, all 111 server tests, and the Storybook build pass. Lint has no errors and one existing character-counter example warning.
- Standards and spec reviews have no remaining findings.
