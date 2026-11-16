# Todai product overview

Todai is a local task board for a single project workspace. It lets you move tasks between columns to have agents work on them.

## Core workflow

1. Create a task with a description of what needs to be done.
2. Move the task to a column with an assigned agent.
3. The agent picks up the task and updates its agent status to **running**.
4. When finished, the agent updates its status to **complete** and leaves a handover comment summarizing what it did.
5. Move the task to another column to repeat the loop with that column's agent.

Tasks stay in their column when a run completes. You control when and where they move next.

## Agents and context

Each column has an assigned agent profile. Profiles use Codex CLI by default and configure the model, effort level, instructions, and permissions.

Agents work directly in the project workspace, using the task description and previous handover comments for context. Handovers appear as ordinary comments on the task; no custom acceptance-criteria or goal fields are needed.

## Local execution

The app runs locally and stores tasks, configuration, and run history in SQLite. Only one agent runs at a time; other tasks wait with a **queued** status.

Moving a task during a run stops that run before the next one starts. Existing changes are preserved, and a comment records the interruption and destination column.

The MVP is one workspace, a task board, configurable agents, agent status updates, and handover comments. There is no automatic movement between columns.
