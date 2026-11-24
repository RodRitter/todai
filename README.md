# Todai

### Your tasks. Your agents. Your machine.

**A task board built for AI agents.** Turn development work into a repeatable workflow with custom agents, clear stage instructions, and visible usage.
Run Codex CLI or Claude Code from one local workspace, from planning through review.

![Todai task board with custom agents, workflow columns, and task status badges.](docs/images/todai-board.png)

## Features

- **Custom agents:** Choose each agent’s instructions, model, effort, and permissions.
- **Column instructions:** Define what agents must do at each workflow stage.
- **Credit and token tracking:** See Codex usage and estimated credits by task, model, and activity.
- **Adaptive workspace memory:** Automatically capture project knowledge from completed tasks for agents to reuse.
- **Optional automation:** Run tasks manually or automate execution and movement between stages.
- **Review in context:** Mention agents in comments and inspect task history.
- **Task artifacts:** Keep documents, images, and files with the work.
- **Multiple workspaces:** Organize projects with separate boards and workflows.
- **Reusable setups:** Import and export agent and board configurations.
- **Local storage:** Keep board data on your machine while agents connect to your AI provider.

## Try Todai

Requires Node.js 24+, macOS or Linux, and a signed-in Codex CLI or Claude Code installation.

```sh
git clone https://github.com/RodRitter/todai.git
cd todai
npm ci
npm run dev
```

Open [Todai](http://127.0.0.1:3000), connect a project folder, and give your first agent a task.
