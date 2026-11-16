# 04: Interrupt execution when tasks move

**What to build:** Let users redirect a running or queued task by moving it to another column. Stop an active run before any next run starts, preserve its workspace changes, record what happened, and queue work for the latest destination's agent. Keep all movement user-controlled.

**Blocked by:** 03: Run agents and capture handovers.

**Status:** complete

- [x] Reuse existing shared components wherever possible, following their Storybook stories as usage examples for composition, variants, and interaction patterns. Extend existing components when needed instead of duplicating them; add or update relevant stories for new or changed UI states.
- [x] Moving a running task to a different column stops its existing agent execution and waits for it to exit before any other agent run starts.
- [x] Existing workspace changes remain intact; interrupting a run does not reset or discard files.
- [x] An ordinary persisted task comment records the interruption and destination column, and the interrupted run is recorded accurately in run history.
- [x] Once stopped, the task is queued for the latest destination's assigned agent under the same single-run rule. The next run receives previous handover and interruption comments as context.
- [x] Moving a queued task replaces its pending destination rather than adding duplicate work. Rapid repeated moves result in at most one pending run for the latest destination.
- [x] Late output or completion from a stopped run cannot overwrite the current run's status or falsely mark the redirected task complete.
- [x] A same-column drop does not interrupt or restart execution, and finishing the replacement run does not move the task automatically.
- [x] Verify interruption ordering, preserved file changes, queued-task moves, rapid repeated moves, and late completion events using a controllable runner; smoke-test stopping a real Codex CLI run in a disposable workspace.

Implemented persisted interruption requests, process-group cancellation, latest-destination queue replacement, stale-result protection, and movement through the existing card/editor controls. Active runs retain the workspace execution lock until their runner and subprocesses exit. Interruption comments and run history persist, and replacement runs receive the comment context.

Verified with 19 passing tests, typechecking, lint, production and Storybook builds, and separate standards/spec reviews with no findings. A real Codex CLI smoke test in a disposable workspace wrote a file, was interrupted by a move to Done, preserved the file, and persisted the interruption. Storybook states and the draggable-card interaction assertion compile; browser interaction execution was unavailable because the browser access host was unavailable.
