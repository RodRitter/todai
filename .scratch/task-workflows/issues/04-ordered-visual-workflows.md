# 04: Compose and execute ordered workflows visually

**What to build:** Build ordered workflows in a structured visual editor and execute their steps in sequence, with durable progress and explicit recovery controls.

**Blocked by:** 03: Run a reusable single-step workflow on a task

**Status:** complete

- [x] Users add, reorder, remove, and configure agent steps visually; connections are automatic and arbitrary graph wiring is not required.
- [x] Saving validates a nonempty executable sequence and valid agent references, with actionable inline errors.
- [x] Successful completion advances to the next step exactly once and updates persisted progress and the Workflow tab.
- [x] Failures and interruptions pause advancement. Explicit retry reruns the failed or interrupted step using preserved workspace work; it does not imply filesystem rollback.
- [x] Server restart preserves completed steps and the active position, marks abandoned executions interrupted, and requires explicit recovery without replaying completed steps.
- [x] Stopping respects existing queue pause semantics and preserves history; resuming the queue alone does not silently resume a stopped task.
- [x] Storybook and integration tests cover multi-step completion, failure, interruption, restart recovery, cancellation, and duplicate completion delivery.


Verification: 174 integration tests passed; typecheck, lint (one existing workspace warning), and Storybook build passed. Browser interaction verification remains pending because the browser access host was unavailable.
