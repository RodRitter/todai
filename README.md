# Todai

### Your tasks. Your agents. Your machine.

**A task board built for AI agents.** Turn development work into a repeatable workflow with custom agents, clear stage instructions, and visible usage.
Run Codex CLI or Claude Code from one local workspace, from planning through review.

![Todai task board with custom agents, workflow columns, and task status badges.](docs/images/todai-board.png)

## Build your workflow

- **Give every agent a role.** Create custom agents with their own instructions, models, effort levels, and permissions.
- **Give every stage a purpose.** Assign agents to columns. Add column instructions for planning, implementation, testing, or review.
- **Choose when work starts.** Run tasks manually, or enable automatic execution and movement between stages.

## See where your credits go

Track Codex token usage and estimated credits by task, model, and activity.
Inspect input, cached input, and output totals, including replies and background checks.
Keep workspace credit usage visible while you work.

## Let workspace memory adapt

Carry useful knowledge from one task to the next.
Completed tasks can automatically update shared workspace memory with project terms, practices, decisions, and preferences.
Agents receive relevant entries and can search for more context, so you spend less time repeating project knowledge.

## Keep the work together

- **Review in context.** Mention agents in task comments and inspect saved run history.
- **Keep the results.** Attach documents, images, and files with revision history.
- **Separate your projects.** Use multiple workspaces and boards, each with its own workflow.
- **Reuse your setup.** Import and export agent and board configurations. Import Jira tickets into task drafts.
- **Run locally.** Store board data on your machine. Agents connect to your selected AI provider.

## Try Todai

Requires Node.js 24+, macOS or Linux, and a signed-in Codex CLI or Claude Code installation.

```sh
git clone https://github.com/RodRitter/todai.git
cd todai
npm ci
npm run dev
```

Open [Todai](http://127.0.0.1:3000), connect a project folder, and give your first agent a task.
