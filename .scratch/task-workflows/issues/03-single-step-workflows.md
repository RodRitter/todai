# 03: Run a reusable single-step workflow on a task

**What to build:** Create a named reusable workflow containing one agent step, select it for a task, and run it independently of column assignment. Persist and display the execution from start to result.

**Blocked by:** 01: Separate run completion from workflow progression; 02: Reorganize task details into an expandable, tabbed workspace

**Status:** complete

- [x] Workspace-scoped workflow creation and editing select an existing agent profile and step-specific instructions; a saved task can select and run that workflow without an agent assigned to its column.
- [x] Persist the workflow execution separately from individual agent runs, with links to its task and step. Snapshot the workflow and agent configuration used so later edits affect future executions only.
- [x] The Workflow tab exposes the actual step instructions, exact supplied agent prompt, run outcome, and result on demand; do not claim access to hidden provider instructions or reasoning.
- [x] Reuse existing queue, workspace isolation, cancellation, artifacts, and executor adapters. Prevent overlapping workflow executions for one task.
- [x] Existing feedback requests still pause and resume the same workflow step. Comment-triggered agent replies do not advance the workflow.
- [x] Existing tasks retain legacy behavior during migration; workflow-backed tasks do not also execute column automation.
- [x] Tests exercise create/select/run/history, configuration edits during execution, feedback, cancellation, failures, duplicate starts, and workspace isolation through persistence and API boundaries.

