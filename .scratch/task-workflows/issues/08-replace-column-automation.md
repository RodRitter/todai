# 08: Replace column automation with workflow-based execution

**What to build:** Finish the transition to customizable high-level board statuses and workflow-controlled execution, removing agent–column assignments and the overlapping automation settings without losing existing work.

**Blocked by:** 06: Run an implement–review–revise loop

**Status:** complete

- [x] Remove agent–column assignment controls and behavior, Auto-run on column entry, and Auto-workflow column sequencing after migrating their stored configuration.
- [x] Preserve existing custom columns and task placement. Workflows optionally map meaningful milestones to existing statuses; ordinary agent steps need no status mapping.
- [x] Provide default milestone mappings for To do, In progress, In review, and Done where those columns exist; require explicit selection for unmapped custom boards rather than guessing by label.
- [x] Disable manual column moves while a workflow execution is active, including queued or waiting work. Users stop it first; moves never start agents. Enforce the rule in both UI and server validation.
- [x] Human review checkpoints can set In review, while internal agent review stays In progress when using default mappings.
- [x] Migrate legacy column pipelines to explicit workflow definitions preserving ordered assigned agents and each task's former automatic/manual continuation behavior through explicit checkpoints; tasks lacking an assignment remain unconfigured and receive a workflow chooser.
- [x] Perform conversion only when legacy queued and running work is drained or explicitly stopped; preserve history and report affected tasks. Conversion is transactional and idempotent, and does not start work.
- [x] Version configuration import/export to include workflows and status mappings; support legacy imports through the same conversion rules. Reject dangling references with useful errors.
- [x] Tests cover custom columns, all legacy automation combinations, tasks without assignments, pending work, rerun-safe migration, legacy import, new round-trip export/import, status milestones, and server-side move restrictions.


Verification: 214 server tests passed, including migration rollback/restart, automation combinations, unassigned gaps, status mappings, configuration transfer, and move restrictions. Typecheck, lint, and Storybook build passed (one pre-existing character-counter lint warning). Standards and spec reviews: zero remaining code findings. Browser interaction and visual verification could not run because the browser access host was unavailable.
