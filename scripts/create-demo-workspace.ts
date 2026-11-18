import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openTaskStore } from "../src/server/database.ts";
import { agentMentionPath } from "../src/domain/agent-mentions.ts";

// Use the application's store so workspace scoping and validation stay intact.
// Re-running preserves an existing demo, including its runs and edited tasks.
const name = "Tiny Launch · Demo";
const requestedPath = resolve(process.env.TODAI_DEMO_PATH ?? "workspace/tiny-launch-demo");
mkdirSync(requestedPath, { recursive: true });
const path = realpathSync(requestedPath);
const registry = openTaskStore();
let workspace;
try {
  const existing = [...registry.listWorkspaces(), ...registry.listArchivedWorkspaces()]
    .find((entry) => entry.path === path);
  if (existing) {
    console.log(`Demo directory already belongs to ${existing.name}. Preserving its contents.\n/?workspace=${existing.id}`);
    process.exitCode = 0;
  } else {
    mkdirSync(path, { recursive: true });
    writeFileSync(resolve(path, "README.md"), `# Tiny Launch demo

A fictional neighbourhood repair café. Everything is local and illustrative;
no real event, bookings, emails, paid services, or deployment are required.

## Walkthrough

Select **Tiny Launch · Demo** in Todai. Start with task 01, then try the others.
Move a task from Backlog to Plan. Auto-run and Auto-workflow are enabled on
tasks 01–05: Planner → Maker → Reviewer → Done. Backlog and Done have no agent.
Each agent's final answer becomes a real task comment. The library starts empty;
the agents publish the artifacts with their actual run provenance.

- 01: Markdown publication, task links, citations, pinned handover attachments,
  and multiple revisions of the same artifact.
- 02: A real feedback request pauses the task. Answer in the feedback UI to
  resume. Example answer: “Saturday at 10:00”. Inspect its attached draft.
- 03: Reuse an artifact from task 01 on a second task. After completion, post
  “@Planner explain the audience, then @Reviewer check that explanation.”
  Observe ordered replies without changing columns. Also try “@Reviewer what
  do you think of @Maker's handover?” to exercise contextual mentions.
- 04: Text, Markdown, PNG image, downloadable file, and external-link artifacts.
- 05: A small local code change, real checks, and review evidence.
- 06: Manual Run, manual column movement, and an optional stop/resume exercise.

In Artifacts, preview a document and image, inspect revision history, and filter
by creator and linked task. In a comment, type # to cite an exact revision or use
the paperclip to attach one. Publish a later revision: the old comment should
still open its original revision while the task link follows the latest one.
Unlink an artifact from a task: its comment attachment remains. Try archiving
and restoring a disposable artifact using the library's archived view.

For queue controls, move two independent tasks into Plan. Pause/resume the queue
or stop an active run. A stopped task needs Run again; Resume queue is separate.
Published artifacts survive interruption. Runs are genuine and need an installed,
signed-in Codex CLI. Read the run history if a run fails; do not fabricate results.

Configuration export/import is available in Settings. Agents use Codex,
gpt-6.1-sol, low effort, and workspace-write permissions. Change profiles there
if your account uses another model. Existing workspaces are unaffected.
`, { flag: "wx" });
    workspace = registry.createWorkspace(name, path, {
      columns: ["Backlog", "Plan", "Make", "Review", "Done"],
    });
  }
} finally {
  registry.close();
}

if (workspace) {
  const store = openTaskStore(workspace.id);
  try {
    const shared = `You work in the Tiny Launch demo, a fictional neighbourhood repair café. Read README.md for context. Keep outputs small, concrete, and self-contained. No network research, real messages, purchases, deployment, or external accounts are needed. Stay inside this workspace. Use the provided todai_artifacts tools to publish real artifacts; a file on disk alone is not a published artifact. Search before publishing to avoid duplicates on reruns; revise the matching artifactId where appropriate. Link deliverables to the current task, nominate exact revisions for the final comment, and cite them using the exact artifact/revision IDs returned by the tools. Never invent IDs or claim a tool succeeded when it did not. Your final response becomes the task comment: explain results, checks, and limitations briefly. When responding to a human @mention, answer that comment only; do not repeat the full task workflow. Never simulate another agent's comments. Follow the task's role-specific instructions.`;
    for (const [column, agentName, instructions] of [
      ["Plan", "Planner", "Create a concise plan and acceptance checklist as a Markdown artifact named '<task title> — Plan'. Make reasonable assumptions unless this task explicitly requires a human decision. Do not implement Maker's deliverables. If feedback is required, publish and nominate a draft first, then use Todai's feedback_request JSON exactly; on resume use the human answer and finish the plan."],
      ["Make", "Maker", "Read the plan, earlier comments, and linked artifact content. Produce the task's requested deliverables and check them. Publish actual content with the artifact tools, link it to this task, and nominate final revisions. Write local files only when useful. Do not merely describe what you would create."],
      ["Review", "Reviewer", "Read the plan, final deliverables, and prior comments. Check the acceptance criteria against actual artifact content and files. Publish a short Markdown review with pass/fail evidence, then link and nominate it. Do not edit source files or silently fix Maker's work. If a substantive requirement fails, request human feedback with a recommended remediation so the task pauses instead of claiming success. Otherwise finish with a clear review verdict."],
    ]) {
      const agent = store.saveAgent({ id: randomUUID(), name: agentName, tool: "codex", model: "gpt-6.1-sol", effort: "low", permissions: "workspace-write", instructions: `${shared}\n\n${instructions}` });
      store.assignColumnAgent({ column, agentId: agent.id });
    }

    const tasks = [
      {
        title: "01 · Write and revise the café launch brief",
        description: `Create a short launch brief for a fictional free neighbourhood repair café. Audience: neighbours with small household items. Do not invent a confirmed date or location.

Planner: publish a plan with the audience, scope, and acceptance criteria.
Maker: publish a Markdown artifact titled 'Café launch brief' with a purpose, audience, three activities, and a welcoming invitation. Publish a second revision of that SAME artifactId adding a volunteer checklist. Link the artifact to this task, cite both revisions in your handover, and nominate the final revision. Keep both versions under 400 words.
Reviewer: read BOTH revisions, verify that the checklist was added and the original purpose survived, and publish your evidence.

Acceptance: real comments from all three agents; a plan, a two-revision brief, and a review in the library; task links and pinned comment references.`,
        comment: "Demo context: keep the tone friendly and practical. This seed comment should be used as context by every agent. Push this task into Plan first; inspect its comments and artifacts when it reaches Done.",
      },
      {
        title: "02 · Ask me to choose the event time",
        description: `Demonstrate a genuine human feedback pause before producing an invitation.

Planner: the event time is deliberately undecided. On the first run, publish a short Markdown draft with two options: Saturday 10:00 or Sunday 14:00. Nominate the draft and request human feedback using Todai's feedback_request response, recommending Saturday 10:00. Do not assume approval or proceed. When the human answers, update the plan with that answer and finish normally; do not ask again if the time has already been answered in the comments.
Maker: publish a Markdown invitation using the human's chosen time, a clearly fictional venue ('Demo community hall'), and a three-item bring-along checklist.
Reviewer: verify the invitation matches the actual human answer and publish a review.

Acceptance: visible feedback question and recommendation, draft attachment, human answer, resumed run, and a finished invitation.`,
        comment: "When this task shows Waiting, answer its feedback request (for example, “Saturday at 10:00”). A plain unrelated comment is not the feedback action. The agent must wait for your choice.",
      },
      {
        title: "03 · Reuse the brief and discuss the FAQ",
        description: `Run after task 01. Create a five-question FAQ for neighbours.

Planner: search for 'Café launch brief', read its latest revision, and link the existing artifact to this task. If it is absent, request feedback recommending completion of task 01; do not invent its contents. Publish a FAQ plan referencing that exact source revision.
Maker: read the shared brief and publish a separate Markdown FAQ about cost, suitable items, volunteers, safety, and unconfirmed timing. Clearly state that repairs are not guaranteed and do not provide technical repair instructions.
Reviewer: check consistency with the shared brief and publish a review.

Acceptance: the SAME brief is linked to two tasks, the FAQ cites its source revision, and the review checks the actual source. After completion the human can use @mentions to demonstrate ordered discussion without moving the card.`,
        comment: "After Done, post: “@Planner explain the audience, then @Reviewer check that explanation.” Then try: “@Reviewer what do you think of @Maker's handover?” Only the requested responders should reply. Use # to cite the FAQ in a follow-up comment.",
      },
      {
        title: "04 · Publish a small artifact sampler",
        description: `Create a tiny local sample pack, all clearly fictional.

Planner: plan the five artifact types and the verification for each.
Maker: publish (1) a plain-text welcome note, (2) a Markdown volunteer checklist, (3) a small valid PNG illustration created locally with available tools, (4) a downloadable CSV file with header 'item,quantity' and three supply rows, and (5) an external-link artifact pointing to https://example.com with a description identifying it as an illustrative placeholder. Use file bytes/base64 for stored files and the correct MIME types. No image-generation service, package install, or network access is necessary; a simple locally encoded geometric PNG is sufficient. Link all five artifacts and nominate them for your handover.
Reviewer: read the stored content, check the PNG signature/dimensions and CSV rows, and verify the external URL as metadata without visiting it. Publish a review.

Acceptance: readable text/Markdown previews, inline PNG preview, downloadable CSV, explicit external-link navigation, and actual agent creator/run provenance.`,
        comment: "Once complete, explore the library's type and creator filters. Open the PNG, download the CSV, and use the paperclip to attach a revision to a comment. You can archive a disposable artifact and find it in Archived artifacts.",
      },
      {
        title: "05 · Build and check a tiny packing-list helper",
        description: `Create a dependency-free Node.js packing-list helper in packing-list.mjs. Export packingList(volunteers), returning { gloves: volunteers * 2, cloths: volunteers, signs: 2 }. Accept integers 1–20; throw RangeError otherwise. No UI or server is required.

Planner: publish a concise implementation plan covering valid values, boundaries, and rejected inputs.
Maker: implement the module and packing-list.test.mjs with node:test. Cover 1, 4, 20, 0, 21, a fraction, and a nonnumber. Run 'node --test packing-list.test.mjs'. Publish a Markdown usage guide and a plain-text artifact containing the actual test result. Link and nominate both.
Reviewer: inspect the code and independently run the tests. Publish a review including the result and any findings.

Acceptance: working local files, passing meaningful checks, actual run history and handover comments, plus downloadable evidence. Do not fabricate successful output.`,
        comment: "This task demonstrates filesystem work as well as library artifacts. The helper stays in this demo's directory and needs no dependencies.",
      },
      {
        title: "06 · Try manual Run and queue controls",
        description: `This task deliberately has Auto-run and Auto-workflow OFF. Move it to Plan, save, and press Run. Move it to Make and Review yourself and press Run in each column.

Planner: publish a three-step plan for a short demo retrospective.
Maker: publish a Markdown retrospective template with 'What worked', 'What surprised us', and 'What to try next', each with one illustrative bullet.
Reviewer: read and check the template, then publish a concise review. The human moves this task to Done manually.

Optional operator exercise: while a run is active, use Stop current run, inspect preserved history/artifacts, then Run again. Resume queue separately if paused. Do not deliberately hang, fail, or add sleeps to make the demonstration longer.

Acceptance: entering a column alone does not execute; Run executes the assigned agent; successful runs leave the card in place until the human moves it.`,
        comment: "Manual control demo: both automation switches are off. To see queued work, push two other independent tasks into Plan. Queue pause/resume affects every workspace, so use it when other work is idle.",
        manual: true,
      },
    ];
    const agentsByName = new Map(store.listAgents().map((agent) => [agent.name, agent]));
    for (const entry of tasks) {
      const description = entry.description.replace(/\b(Planner|Maker|Reviewer)\b/g, (name) => {
        const agent = agentsByName.get(name)!;
        return `[@${agent.name}](${agentMentionPath(agent.id)})`;
      });
      const task = store.save({ id: randomUUID(), title: entry.title, description, status: "Backlog", autoRun: !entry.manual, autoWorkflow: !entry.manual });
      store.addComment({ id: randomUUID(), taskId: task.id, body: entry.comment, authorName: "Demo guide", createdAt: new Date().toISOString() });
    }
    console.log(JSON.stringify({ workspace, agents: store.listAgents().length, tasks: store.list().length, columns: store.listColumns(), url: `/?workspace=${workspace.id}` }, null, 2));
  } finally {
    store.close();
  }
}
