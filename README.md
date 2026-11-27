<div align="center">

# Todai

### Your tasks. Your agents. Your machine.

A local task board for AI agents.<br>
Build a repeatable workflow from planning through review.

**Codex CLI & Claude Code · Custom agents · Usage tracking · Workspace memory**

[Explore the features](#built-for-agent-work) · [Try Todai](#try-todai)

</div>

![Todai task board with custom agents, workflow columns, and task status badges.](docs/images/todai-board.png)

## Built for agent work

- **Your agents, your rules.** Choose roles, instructions, models, effort levels, and permissions.
- **A purpose for every column.** Assign agents and define the work required at each stage.
- **Visible credit usage.** Track Codex tokens and estimated credits by task, model, and activity.
- **Memory that adapts.** Use a completion column to capture project knowledge automatically for agents to reuse.

## From task to result

- **Automate at your pace.** Run tasks manually or automate execution and movement between stages.
- **Keep task changes separate.** Run agents in managed Git worktrees, with a separate branch for each task.
- **Keep the discussion close.** Mention agents in comments, use task chat, and inspect task history.
- **Keep the output.** Attach documents, images, and files to the work.

## Make it your workspace

- **Organize multiple projects.** Use separate workspaces, boards, and workflows.
- **Edit local skills.** Browse agent skills and edit workspace or Todai skill instructions.
- **Reuse your setup.** Import and export agent and board configurations.
- **Store data locally.** Keep board data on your machine while agents connect to your AI provider.

## Works best with

- **[VS Code](https://code.visualstudio.com/).** Open task worktrees from Todai and review unstaged changes in Source Control. Use its terminal to run checks.
- **[Git](https://git-scm.com/).** Keep each task in a separate worktree. Move the task to the completion column after review to commit its changes.
- **Codex CLI or Claude Code.** Run your agents with your installed tool. Configure it in Executor settings.

Install VS Code on the computer that runs Todai. Allow your browser to open VS Code links when prompted.

---

## Try Todai

Requires **Node.js 24+**, **macOS or Linux**, and a signed-in **Codex CLI** or **Claude Code** installation.

```sh
git clone https://github.com/RodRitter/todai.git
cd todai
npm ci
npm run dev
```

Open **[Todai →](http://127.0.0.1:3000)**, connect a project folder, and give your first agent a task.

### Workspace memory

Memory records have a short summary and optional details of up to 12,000 characters. Keep critical exceptions in the summary or scope. Agents can read the details and original source tasks through the memory tools.

Search ranks matching words and a local list of related concepts. For example, a search for “login” can find “authentication”. Search also includes detailed evidence. This is deterministic concept matching, not embedding-based semantic search.

Automatic task context uses an 8,000-character budget for record summaries. Set `TODAI_MEMORY_CONTEXT_CHARACTERS` to change this budget, from 0 to 64,000 characters. Agents can retrieve more records through the memory tools. Run history lists records supplied during setup and records read through those tools. These events show access, not proof that a record influenced a decision.

Use the memory page to correct records, mark them for review, inspect history, or retire them. The **Include retired records** control gives access to retired history. Review flags exclude records from automatic context. The page marks records older than 180 days for a source check; age alone does not invalidate a record.

Memory rejects normalized duplicates. Different statements with the same title and scope trigger review flags on both records. This detects likely conflicts, not every contradiction. An explicit replacement can retire the previous decision and preserve its history. Clear memory deletes these saved versions too.
