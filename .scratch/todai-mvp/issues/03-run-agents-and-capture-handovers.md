# 03: Run agents and capture handovers

**What to build:** Moving a task into an agent's column queues a Codex CLI run in the project workspace using that column's configured profile. Users can follow its execution status and read its handover when finished. Runs execute one at a time and leave tasks in their chosen columns. This slice establishes the complete execution loop; moving an actively running task is delivered by ticket 04.

**Blocked by:** 02: Configure column agents.

**Status:** complete

- [x] Reuse existing shared components wherever possible, following their Storybook stories as usage examples for composition, variants, and interaction patterns. Extend existing components when needed instead of duplicating them; add or update relevant stories for new or changed UI states.
- [x] Moving a task to a different column with an assigned agent creates one queued run; a same-column drop or page reload does not create another run. Creating a task alone does not trigger execution.
- [x] At most one agent runs at a time across the workspace. Additional eligible runs wait with a queued status and start in queue order when the active run ends.
- [x] Codex CLI runs directly in the project workspace with the configured model, effort, instructions, and permissions, using the task description and previous handover comments as context.
- [x] The board reflects queued, running, and complete states without requiring a page reload. Execution status is separate from the task's column.
- [x] Successful completion persists run history and a handover summary as an ordinary task comment, visible in task details after reload and restart.
- [x] Completion never moves the task automatically. Moving the completed task into another agent's column starts the next loop with earlier handovers available as context.
- [x] Launch errors and unsuccessful runs show an understandable failure, are recorded in run history, and release the queue so another task can proceed.
- [x] A local app restart does not silently rerun completed work or leave abandoned runs permanently shown as running; interrupted work is surfaced without requiring automatic retries or resumable execution.
- [x] Verify the queue, run outcome, and handover context with a controllable runner, including failure followed by another task. Smoke-test one real Codex CLI run in a disposable workspace.

Implemented a SQLite-backed FIFO execution service, Codex CLI adapter, persisted run history and comments, startup recovery, and live board polling. Agents default to a separate ignored `workspace/` directory; set `TODAI_WORKSPACE_PATH` and restart to change it. Queued/running moves and deletion wait for ticket 04.

Verified queue ordering, duplicate prevention, profile snapshots, failure followed by another task, handover context, persistence, restart recovery (including stopping an orphan process), and reused process IDs through controllable runner tests. A real Codex CLI smoke run in a disposable directory created and verified a file and returned its handover. All 14 tests, production and Storybook builds, typechecking, and lint passed. A production API smoke check with a disposable database and controllable CLI verified queueing, configured workspace output, same-column deduplication, handover persistence, and an actual server restart. Live-execution Storybook interactions were added and compiled; browser execution could not be checked because the browser host was unavailable.
