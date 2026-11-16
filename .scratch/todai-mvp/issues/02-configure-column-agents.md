# 02: Configure column agents

**What to build:** Let users configure the agent profile assigned to each existing column. Profiles use Codex CLI by default and specify the model, effort level, instructions, and permissions used when a task enters that column. Keep configuration simple and local to the single workspace; a separate profile marketplace or multi-provider framework is out of scope.

**Blocked by:** 01: Persist the task board.

**Status:** complete

- [x] Reuse existing shared components wherever possible, following their Storybook stories as usage examples for composition, variants, and interaction patterns. Extend existing components when needed instead of duplicating them; add or update relevant stories for new or changed UI states.
- [x] Users can view and change each column's assigned agent configuration from the app, including model, effort level, instructions, and permissions.
- [x] Codex CLI is the default execution tool; adding other agent providers is not required.
- [x] Column assignments and profile settings are stored in SQLite and survive reloads and app restarts.
- [x] Invalid or incomplete required settings produce an actionable validation message rather than silently saving an unusable profile.
- [x] The board identifies the configured column agent; task-level owner selection does not override the column's agent assignment.
- [x] Saving profile settings alone does not start an agent run.
- [x] Verify saving and reopening column configuration, persistence after restart, and validation of invalid settings.

Implemented per-column Codex CLI settings in SQLite with a shared-component editor, visible agent names, required-field validation, and failed-save draft retention. Verified with store tests, Storybook interactions, and a production browser flow covering save/reload, invalid API input, and an actual app-process restart against a temporary database. Saving settings leaves task state unchanged.
