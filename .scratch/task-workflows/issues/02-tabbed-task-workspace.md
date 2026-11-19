# 02: Reorganize task details into an expandable, tabbed workspace

**What to build:** Make task details readable through stable Overview, Workflow, Activity, and Artifacts tabs in an expandable modal. Deliver this using current persisted data before the new workflow engine exists.

**Blocked by:** None (can start immediately)

**Status:** complete

- [x] Overview opens first and foregrounds pending human feedback with its recommendation, reply control, and relevant evidence; otherwise it shows the task description and latest result.
- [x] A shared header shows task status and actual execution state. Workflow presents available run information and a clear empty state until workflows exist.
- [x] Activity preserves existing comments, feedback, author identity, timestamps, agent mentions, and run-history access; Artifacts preserves previews and revision references.
- [x] Use local shadcn/ui primitives and compatible AI Elements presentation patterns, especially Message, Trace-style entries, and citations. Preserve the rich-text editor and CLI execution layer.
- [x] Cross-tab links select the relevant record; tabs remain stable and never switch automatically during reading. Expanding preserves selection, drafts, and reading position.
- [x] Keyboard access, focus handling, narrow layouts, and light/dark presentation work; badges indicate attention needed rather than raw event volume.
- [x] Storybook covers simple work, long feedback, many artifacts, and pending decisions with realistic content. Interaction checks verify feedback and existing task actions remain usable.

