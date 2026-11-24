# Todai user guide

[← Back to the README](../README.md)

For installation and your first task, see the [quick start](../README.md#-quick-start).

## Workspaces and task execution

Add another named workspace in **Settings → Workspace → Add workspace**, then switch using the sidebar selector. Each workspace has its own tasks, agents, columns, assignments, and default executor. Selection lives in the browser URL, so separate tabs can work independently. Switching clears unsaved drafts and leaves queued and active runs in their original directories.

Task automation is opt-in. Enable **Auto-run** to start the assigned agent when a task enters a column. Enable **Auto-workflow** to move to the next column after a successful run; the next agent waits for **Run** unless Auto-run is also enabled. Save task edits before pressing Run.

New boards start with **To do**, **In progress**, **In review**, and **Done**. Customize them in **Settings → Board**.

In a task’s Activity tab, write a rich text comment and type **@** to select agents. Comments without mentions stay as context. A lightweight intent agent selects which tagged agents are being asked to respond and orders their replies; agents mentioned only as context do not respond. For example, “@Reviewer what do you think of @Implementor's comment?” asks only Reviewer to reply. Each responding agent sees earlier responses. The intent agent uses the default executor with `gpt-6-luna` (Codex) or `haiku` (Claude), at low effort. If intent detection fails, no replies start; post the comment again to retry. Comment replies keep the task in its current column.

Open a saved task’s **Activity** tab to read the agent’s comments and results. The comments appear directly in the tab.

The header’s execution indicator shows the active agent, task, and workspace, along with queued jobs across workspaces. **Stop current run** terminates the agent and its commands, preserves saved files and history, and pauses the queue across all workspaces. The pause survives app restarts. **Run again** on a stopped task requests a new run using saved work and history; **Resume queue** is a separate action. Other queued requests remain queued, and requests for a stopped task wait until you explicitly run it again.

To change a workspace directory, stop the running agent or use **Pause queue** in the header. Save the directory in **Settings → Workspace**, then choose **Resume queue**. If queued jobs still reference an old directory, confirm their new destinations; cancelling leaves the queue paused. Explicitly running a stopped task uses the current workspace directory.

Use **Archive this workspace** in Settings when it has no running or queued jobs. Archived workspaces leave the selector but retain their tasks, history, configuration, and files. Restore them from Settings; when no active workspaces remain, the app offers creation and restoration.

Agents run one at a time. Keep the server running while they work. Todai is designed for a persistent local Node.js process on macOS or Linux.

## Task statuses

A task has two separate status fields:

- **Board status** (`status`) selects the workflow column. Default columns are **To do**, **In progress**, **In review**, and **Done**.
- **Agent status** (`agentStatus`) supplies the task badge. Todai sets this field from execution events.

Column names are configurable. Moving a task into **In review** does not create a separate agent status.

### Active agent statuses

| Badge | When Todai sets it | What to do next |
| :--- | :--- | :--- |
| **Not started** | A task is created, or its execution state is reset without a queued run. | Assign a column agent, then select **Run** when ready. |
| **Queued** | A run is requested and has not started. | Keep the server running. Resume the queue if it is paused. |
| **Running** | The executor claims a queued run. | Follow the task, or stop the run if necessary. |
| **Complete** | A run finishes successfully, with no pending feedback or queued follow-up run for the task. | Read the result and decide whether to continue the workflow. |
| **Waiting** | An agent requests feedback, or the task still has a pending feedback request. | Answer the request in **Activity** to queue the continuation. |
| **Failed** | A run fails, with no pending feedback or queued follow-up run taking precedence. | Read the error, correct the cause, and retry when ready. |
| **Interrupted** | A run is interrupted, such as after a column move or an app shutdown. | Check the saved work before starting another run. |
| **Stopped** | You stop a running task or cancel its queued run. Removing a pending feedback request can also set this badge. | Select **Run again** when ready to continue the task. |

**Complete describes a run, not the whole task.** A successful build can move a task to **In review** while its badge remains **Complete**.
The next agent starts only when you select **Run**, unless **Auto-run** is enabled.
Moving a task can preserve its previous completion or failure badge.

**Queue pause is a separate control.** Pausing the queue does not assign a new task badge.
Queued tasks remain queued until execution can continue.
The header shows the queue state across workspaces; each card shows its own agent status.

### Screenshot example

The README screenshot shows a sample release board with no active run:

- Planned tasks have not started.
- One implementation task needs feedback; another was stopped before execution.
- Completed builds are in **In review**, ready for the reviewer.
- Reviewed tasks are in **Done** with completed runs.

For documentation screenshots, use a separate sample database and the normal task execution transitions.
Use only the active badges listed above. Keep the header, task badges, run records, and feedback requests consistent.
Do not assign badge values directly in SQLite to create a screenshot.

## Data and configuration

Data is stored in `.todai/tasks.sqlite`. Set `TODAI_DB_PATH` to use another database file. Preserve the database to keep your tasks, profiles, settings, and run history across restarts.

The agent workspace is configured separately in Settings. Configuration exports include selected agents, columns, and assignments; they do not include tasks or workspace paths.

Settings tabs can be linked directly with `/settings?tab=general`, `/settings?tab=workspaces`, `/settings?tab=board`, or `/settings?tab=executors`.

Changing the default executor only affects new agent forms. Existing profiles and queued runs retain their executor. Codex sandbox modes and Claude permission modes have different meanings; the agent editor shows the available choices for each tool. Claude runs deny unresolved permission prompts and report denied actions as failures. Connection tests make a small model request; refreshing installation and sign-in status does not.

## Artifacts

Open **Artifacts** in the sidebar. **Create artifact** opens a document modal; its adjacent dropdown offers **Document** and **Image**. Documents use the same rich-text Markdown editor as task descriptions. Images accept PNG, JPEG, GIF, WebP, AVIF, and BMP uploads. Plain text and Markdown are grouped as documents. Search the workspace collection and filter by type or creator. Existing files and external links remain available, and agents can still publish them. Creator names are descriptive labels entered by the publisher.

Stored content is limited to **20 MiB per artifact**. The database stores document content and metadata together. Back up `.todai/tasks.sqlite` (or `TODAI_DB_PATH`) to preserve artifacts. Uploading copies the file bytes. Changes to the original file do not affect the artifact. External links store only their URL and metadata.

Use **Edit** to change an artifact. Select **Save changes** to replace its content and metadata. The artifact keeps its ID and creation date. Artifacts have no revision history.

**Archive** removes an artifact from normal discovery. Select **Archived artifacts** to find it again. Archived content remains available for reading and download.

In task details, the **Artifacts** tab lists artifacts linked through comments, the task description, or chat. Add links in those contexts. The Artifacts tab has no manual add control. Use the **paperclip** in a comment to attach a document. Task links and comment attachments open the current document. Removing a task link keeps comment attachments intact. Deleting a task preserves its artifacts. Use **Linked task** in the library to filter artifacts by task links and comment references.

Type **#** in the comment editor to search artifacts and insert a citation. Hover or focus a saved citation to see its title and type. Click the citation to open the document. Agents use `[Artifact title](#artifact/ARTIFACT_ID)`. Old links with a revision ID also open the current document. Repeated citations share one association per comment and artifact.

Open an artifact to preview its content. Text and Markdown are readable, raster images display inline, and PDFs have page controls. PDF pages render with PDF.js without document scripts or interactive forms. Unsupported files offer metadata and downloads. External links show metadata and an action to open the URL. Empty, unavailable, or damaged content has an explanatory state.

During a run, Codex and Claude receive workspace-scoped artifact tools. Agents can create and edit documents, upload files, save external links, search artifacts, and manage task links. The starting prompt includes artifact metadata for the current task. Saved artifacts record their task and run and appear in the library immediately.

Agents can nominate documents for their final handover or feedback request. The system saves attachments with the comment and removes duplicate references. Tools expire when execution ends or is interrupted. Saved work survives failure or interruption. Nominations do not attach to failure or interruption notices. The tools cannot archive artifacts or choose a different workspace, task, creator, or run.


## Jira import

Task dialogs separate **Detail** (ticket fields) from **Activity** (comments and artifacts). New tasks also offer **Import JIRA Ticket**: select an existing agent and paste an HTTPS `/browse/KEY-123` link. The importer uses that agent's executor/model with dedicated instructions to read only the specified ticket and never edit, comment, transition, or otherwise change Jira. Browser/Jira access must already be configured; this prompt is not a Jira permission boundary. Successful imports fill an unsaved draft with a source link, turn off automatic execution, and return to Detail for review. Creating the task is a separate action; failed imports preserve the draft.

## Column instructions

In **Settings → Board**, select a board. Select a column’s **Configure** button to edit its name and custom instructions.
On the task board, hover over a column name and select its edit button to open the same settings.
The edit button also appears on keyboard focus and touch devices.
Instructions supplement the agent’s reusable instructions. They apply to task runs and agent replies in that column.
Todai captures the instructions when each run starts and keeps that copy in the run record.
Changes affect queued runs when they start. Changes do not affect an active run.
Instructions remain with a column when it is renamed or reordered. Configuration exports include them.

Use the instructions to describe the stage’s purpose, required work, verification steps, and expected handover.
For example: “Review the changes against the task requirements. Run the relevant tests. Report findings, test results, and unfinished work.”
Instructions guide the agent. They do not change Auto-run, Auto-workflow, or the agent’s permissions.

## Workspace memory

Open **Memory** in the sidebar to search accepted entries. Each accordion row shows a title and category. Expand a row to read its statement, scope, source, and revision. Results show 20 entries per page. Use **Previous** and **Next** to change pages. A new search returns to the first page. Select **Refresh** to load changes accepted elsewhere.

Select **Clear memory** to remove all accepted entries and saved memory versions in the current workspace. Confirm the action in the dialog. Clearing also cancels pending memory reviews. Task comments and other workspaces remain unchanged. This action cannot be undone.

Workspace memory stores accepted terms, practices, decisions, and preferences. All boards in the same workspace share this memory. Other workspaces have separate memory.

To enable automatic review:

1. Open the column settings from the board or the board settings editor.
2. Enable **Completion column**.
3. Select **Save settings**.

Each board can have at most one completion column. Enabling another column unmarks the previous column in the same save. Disable the current switch to stop automatic memory reviews. Renaming or reordering a column preserves its setting. Existing tasks do not receive reviews when this setting changes.

When a task enters the completion column, Todai queues a built-in memory review. This review replaces the assigned column agent while the completion setting is enabled. It uses the workspace's default executor and requires no separate agent assignment. It runs for manual moves and automatic workflow moves, including tasks with automatic agents disabled. The global execution pause still applies.

The reviewer searches recorded memory and automatically saves supported entry additions, changes, and removals. It posts a short change count on the task. No approval feedback is required.

These updates do not move the task. If there is no useful change, Todai posts **No memory changes recorded**. If a review fails, use the task's run action to retry it. Revision checks prevent stale changes from overwriting newer entries.

Task, reply, and chat runs receive up to five relevant entries within a 4,000-character budget. Agents with tools can search memory and read selected entries. Search returns short excerpts; reading returns exact content and revisions. The reviewer has only read-only memory tools. Memory does not grant permissions or override current instructions.

Old pending memory approvals are cancelled and replaced with fresh automatic reviews. Clearing memory cancels these reviews too.

## Archived tasks and references

Select **Archive task** from the task actions menu to remove a task from its board. Its ID, comments, chats, artifacts, usage, and run history remain stored. Tasks with queued or running work must finish or stop before archiving.

Select **Copy task reference** to copy a reference based on the task ID. References use `[Task ID](#task/ID)`. They open a read-only task page, including archived tasks. Existing local task links continue to resolve. Archived tasks cannot be edited or reused as new tasks.
