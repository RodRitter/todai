<div align="center">

# Todai

### Your tasks. Your agents. Your machine.

A local task board for AI coding agents.<br>
Plan work, run Codex CLI or Claude Code, and review the results in one place.

**🏠 Hosted locally · 🤖 Subscription access · 🗂️ Workspaces · ⚡ Optional automation**

[Quick start](#-quick-start) · [Features](#-built-for-your-workflow) · [Development](#-development) · [User guide](docs/user-guide.md)

</div>

![Todai in light mode, with a four-column task board, assigned agents, and task status badges.](docs/images/todai-board.png)

<p align="center"><sub>A sample release board in light mode: planned work, a feedback request, completed builds awaiting review, and finished tasks.</sub></p>

## ✨ Built for your workflow

| | What you get |
| :--- | :--- |
| 🏠 **Your machine, your data** | Run the board locally. Store tasks, settings, history, and artifacts in SQLite. No hosted Todai service required. |
| 💳 **Use your Codex subscription** | Sign in to Codex CLI with an eligible ChatGPT plan. Use subscription access without a separate API key. |
| 🤖 **Agents for your workflow** | Create agents with custom roles and instructions. Choose each agent’s executor, model, effort, and permissions. Optional starter agents help you begin. |
| ⚡ **Control when work starts** | Run tasks manually, or enable Auto-run and Auto-workflow to connect the steps. |
| 🗂️ **Keep projects organized** | Use separate workspaces and multiple boards. Customize columns and assign an agent to each stage. |
| 💬 **Review work in context** | Mention agents in comments, follow their replies, and inspect saved run history. |
| 📎 **Keep the outputs** | Store documents, images, and files with revision history. Link artifacts to tasks or cite exact revisions in comments. |
| 🔁 **Reuse your setup** | Import and export agents, columns, and assignments as JSON. Import Jira tickets into task drafts. |

**Local hosting keeps the board under your control.** The supplied server commands bind to `127.0.0.1`.
AI requests still go to the selected provider and can include task content and code.
Local hosting does not remove those external data flows or the need to set agent permissions.

**Codex uses your existing CLI sign-in.** ChatGPT subscription access remains subject to plan limits.
API-key authentication uses separate API billing. See [OpenAI’s authentication guide](https://developers.openai.com/codex/auth).

## 🚀 Quick start

### 1. Check the requirements

| Requirement | Details |
| :--- | :--- |
| Runtime | **Node.js 24 or newer**, with npm |
| Platform | **macOS or Linux**, with a persistent local Node.js process |
| Agent executor | **Codex CLI** or **Claude Code**, installed and signed in on the same machine |
| Claude Code, if used | Version **2.1.259 or newer** |

For Codex CLI:

```sh
npm install -g @openai/codex
codex
```

Select **Sign in with ChatGPT** to use an eligible subscription.
See the [official Codex installation instructions](https://github.com/openai/codex#installing-and-running-codex-cli) for other installation methods.

### 2. Start Todai

```sh
git clone https://github.com/RodRitter/todai.git
cd todai
npm ci
npm run dev
```

Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)**.
The default setup needs no `.env` file or separate database server.

### 3. Run your first task

1. Create a workspace with a name and an existing project folder.
2. Select the optional **Planner**, **Builder**, and **Reviewer** starter agents.
3. In **Settings → Executors**, check installation and sign-in status.
4. In **Agents**, select a model available to your account and set the agent’s permissions.
5. Assign an agent through a column’s agent selector.
6. Create a task in that column with a clear title and description.
7. Save the task, then select **Run**.

The workspace folder is the project that agents work in. It can be a different repository from Todai.
Keep the Todai server running while agents work. Agents run one at a time.

> 💡 **Start manually. Automate when ready.** Tasks use manual execution by default.
> Enable **Auto-run** to start work on column entry.
> Enable **Auto-workflow** to move a task to the next column after a successful run.

## 🧭 From task to reviewed work

```text
    To do          In progress         In review           Done
   Planner   ───▶    Builder     ───▶    Reviewer    ───▶  Complete
```

Columns and assignments are configurable. Each agent can use Codex CLI or Claude Code.
Task comments and artifacts keep the context with the work.

**Columns show workflow stages. Badges show agent execution.** A task in **In review** can show **Complete** after its build finishes.
That badge does not mean the review or the whole task is complete.
See the [status reference](docs/user-guide.md#task-statuses) for all active badges and their meanings.

- **Ask an agent:** Type `@` in a comment to select agents. Requested replies run in order.
- **Inspect a run:** Open the saved task’s **Activity** tab to read the agent’s comments and results.
- **Stop work:** Use **Stop current run** in the header. This stops the agent and pauses the queue across workspaces.
- **Continue work:** Use **Run again** for a stopped task or **Resume queue** for other queued work.
- **Share an output:** Link an artifact to a task, or type `#` in a comment to cite an exact revision.

See the [user guide](docs/user-guide.md) for queue controls, workspace changes, artifact revisions, and Jira imports.

## 💾 Local data and configuration

```text
todai/
└── .todai/
    └── tasks.sqlite    # Tasks, agents, settings, run history, and stored artifacts
```

Todai creates the database automatically. The `.todai/` directory is excluded from Git.
To use another database file:

```sh
TODAI_DB_PATH=/absolute/path/to/tasks.sqlite npm run dev
```

Set the same variable when starting a production build if you use a custom database path.
Stop Todai before copying the database for a simple file backup.
Back up your project folders separately; the database does not contain the source files that agents edit.

Configuration exports include agents, columns, and assignments. They do not include tasks or workspace paths.

## 🛠️ Development

**Next.js · React · TypeScript · Tailwind CSS · SQLite**

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check application and Storybook types |
| `npm test` | Run server and project tests with temporary databases |
| `npm run test:theme` | Check theme behavior |
| `npm run storybook` | Open the component explorer on port 6006 |
| `npm run build-storybook` | Build the static component explorer |

For a production build on your machine:

```sh
npm run build
npm start
```

### Project map

```text
src/
├── app/           # Pages and API routes
├── components/    # UI components and Storybook stories
├── domain/        # Shared models and validation
├── lib/           # Client API and utilities
└── server/        # SQLite storage, agent execution, and server tests
docs/              # Usage, design, and writing guides
tests/             # Project tests
```

### Contributing

Keep changes focused. Add tests for new behavior. Run lint, type checks, and tests before opening a pull request.

- [Design guidelines](docs/design-guidelines.md) — shared components, interaction, and themes.
- [Component styling](src/components/ui/style-guide.mdx) — also available in Storybook under **Foundations → Component styling**.
- [Writing rules](docs/writing-rules.md) — project language and documentation conventions.
- [User guide](docs/user-guide.md) — detailed operating instructions.
