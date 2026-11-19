# 01: Separate run completion from workflow progression

**What to build:** Preserve existing task execution while isolating the decision to advance, queue another run, or wait behind a testable workflow progression interface. This is the prerequisite behavior-preserving prefactor; do not introduce new user-facing workflow controls.

**Blocked by:** None (can start immediately)

**Status:** complete

- [x] Run completion records its outcome and delegates progression through a single interface; the existing queue and executor adapters remain in use.
- [x] Existing column advancement, Auto-run, Auto-workflow, ordered comment replies, and human feedback resume behavior remain unchanged.
- [x] Failed, stopped, or interrupted executions never accidentally advance; duplicate completion handling does not queue duplicate work.
- [x] Regression tests cover progression and feedback through the interface, including queued work and workspace isolation.
- [x] Existing lint, type checks, and relevant execution tests pass.

