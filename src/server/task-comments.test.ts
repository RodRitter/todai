import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";
import { ExecutionService, type Runner } from "./execution-service.ts";
import { mentionedAgentIds } from "../domain/agent-mentions.ts";
import { agentPrompt } from "./agent-prompt.ts";

const profiles = ["Refiner", "Implementor", "Reviewer"].map((name) => ({
  id: name.toLowerCase(), name, tool: "codex", model: "test-model", effort: "medium",
  permissions: "workspace-write", instructions: `Work as ${name}.`,
}));
function fixture(runner: Runner) {
  const directory = mkdtempSync(join(tmpdir(), "todai-comments-"));
  const store = new TaskStore(join(directory, "tasks.sqlite"));
  for (const profile of profiles) store.saveAgent(profile);
  store.save({ id: "task", title: "Feature", description: "Details", status: "To do", autoWorkflow: true });
  return { store, directory, service: new ExecutionService(store, runner),
    cleanup() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("mentions resolve rich text IDs and typed names, deduplicate, and ignore code, emails and file links", () => {
  assert.deepEqual(mentionedAgentIds("@Reviewer then [@Refiner](#agent/refiner) and @reviewer", profiles), ["reviewer", "refiner"]);
  assert.deepEqual(mentionedAgentIds("user@Reviewer.com `@Refiner` ```\n@Implementor\n``` [@Reviewer](/file) @ReviewerExtra", profiles), []);
  assert.deepEqual(mentionedAgentIds("@Code Reviewer then @Code", [{ id: "a", name: "Code" }, { id: "b", name: "Code Reviewer" }]), ["b", "a"]);
});

test("plain comments persist as Human context without invoking an agent; invalid submissions are atomic", async () => {
  const f = fixture(async () => { throw new Error("Must not execute"); });
  try {
    const saved = f.store.postComment("task", " **Useful context** ");
    assert.equal(saved.comments![0].authorName, "Human");
    assert.equal(saved.comments![0].body, "**Useful context**");
    assert.equal(saved.agentStatus, "Not started");
    assert.equal(f.store.history().length, 0);
    assert.throws(() => f.store.postComment("task", " "), /Enter a comment/);
    assert.throws(() => f.store.postComment("missing", "Note"), /no longer exists/);
    assert.throws(() => f.store.postComment("task", "[@Gone](#agent/gone)"), /no longer exists/);
    assert.equal(f.store.list()[0].comments!.length, 1);
    await f.service.drain();
  } finally { f.cleanup(); }
});

test("intent chooses reply order, profiles survive edits, and later agents see earlier replies without moving the task", async () => {
  const calls: string[] = [];
  const f = fixture(async (request) => {
    const { run, task } = request;
    calls.push(run.profile.name);
    if (run.kind === "intent") {
      assert.equal(run.profile.effort, "low");
      assert.equal(run.profile.permissions, "read-only");
      assert.match(agentPrompt(request), /JSON array/);
      return '["refiner","implementor","reviewer"]';
    }
    assert.equal(run.profile.model, "test-model");
    assert.match(agentPrompt(request), /Respond to this human comment/);
    if (run.profile.id === "reviewer") assert.ok(task.comments?.some((comment) => comment.body === "Implementor response"));
    return `${run.profile.name} response`;
  });
  try {
    f.store.postComment("task", "@Reviewer @Implementor @Refiner please refine, build and review.");
    f.store.saveAgent({ ...profiles[1], model: "changed-model" });
    await f.service.drain();
    assert.deepEqual(calls, ["Intent", "Refiner", "Implementor", "Reviewer"]);
    assert.equal(f.store.list()[0].status, "To do");
    assert.equal(f.store.list()[0].agentStatus, "Complete");
    assert.deepEqual(f.store.list()[0].comments!.map((comment) => comment.authorName), ["Human", "Refiner", "Implementor", "Reviewer"]);
    await f.service.drain();
    assert.equal(calls.length, 4);
  } finally { f.cleanup(); }
});

for (const { comment, selected, expected } of [
  { comment: "@Reviewer what do you think of @Implementor's comment?", selected: '["reviewer"]', expected: ["Reviewer"] },
  { comment: "[@Reviewer](#agent/reviewer) what do you think of [@Implementor](#agent/implementor)'s comment?", selected: '["reviewer"]', expected: ["Reviewer"] },
  { comment: "I agree with @Implementor's comment.", selected: "[]", expected: [] },
]) {
  test(`intent selects only requested responders: ${comment}`, async () => {
    const calls: string[] = [];
    const f = fixture(async ({ run }) => {
      if (run.kind === "intent") return selected;
      calls.push(run.profile.name);
      return `${run.profile.name} response`;
    });
    try {
      f.store.postComment("task", comment);
      await f.service.drain();
      assert.deepEqual(calls, expected);
      assert.equal(f.store.history()[0].status, "Complete");
      assert.deepEqual(f.store.list()[0].comments!.map((item) => item.authorName), ["Human", ...expected]);
      assert.equal(f.store.list()[0].agentStatus, "Complete");
      assert.equal(f.store.list()[0].status, "To do");
    } finally { f.cleanup(); }
  });
}

for (const output of ["not JSON", '["refiner","refiner"]', '["stranger"]', '{}', '[1]', "null", "throw"]) {
  test(`intent failure does not invoke unconfirmed responders: ${output}`, async () => {
    const calls: string[] = [];
    const f = fixture(async ({ run }) => {
      if (run.kind === "intent") {
        if (output === "throw") throw new Error("Unavailable");
        return output;
      }
      calls.push(run.profile.name);
      return "Response";
    });
    try {
      f.store.postComment("task", "@Reviewer @Refiner");
      await f.service.drain();
      assert.deepEqual(calls, []);
      assert.match(f.store.history()[0].summary!, /No replies were started/);
      assert.equal(f.store.list()[0].agentStatus, "Failed");
      assert.deepEqual(f.store.list()[0].comments!.map((comment) => comment.authorName), ["Human"]);
    } finally { f.cleanup(); }
  });
}

test("feedback pauses remaining replies and resumes the same chain across reopened stores", async () => {
  const calls: string[] = [];
  const f = fixture(async ({ run, task }) => {
    if (run.kind === "intent") return '["refiner","reviewer"]';
    calls.push(run.profile.name);
    if (run.profile.id === "refiner" && !task.comments?.some((comment) => comment.body === "Yes"))
      return '{"type":"feedback_request","question":"Proceed?","recommendation":"Yes."}';
    return "Done";
  });
  try {
    f.store.postComment("task", "@Refiner @Reviewer");
    await f.service.drain();
    assert.deepEqual(calls, ["Refiner"]);
    assert.equal(f.store.list()[0].agentStatus, "Waiting");
    f.store.postComment("task", "Extra context");
    const reopened = new TaskStore(join(f.directory, "tasks.sqlite"));
    try {
      const pending = reopened.list()[0].comments!.find((comment) => comment.feedbackStatus === "pending")!;
      reopened.answerFeedback("task", pending.id, "Yes");
    } finally { reopened.close(); }
    await f.service.drain();
    assert.deepEqual(calls, ["Refiner", "Refiner", "Reviewer"]);
    assert.equal(f.store.list()[0].status, "To do");
  } finally { f.cleanup(); }
});

test("moving a task during intent cancels all planned replies", async () => {
  const f = fixture(async ({ task }) => {
    f.store.save({ ...task, status: "Done" });
    return '["refiner","reviewer"]';
  });
  try {
    f.store.postComment("task", "@Refiner @Reviewer");
    await f.service.drain();
    assert.equal(f.store.history().length, 1);
    assert.equal(f.store.history()[0].status, "Interrupted");
    assert.deepEqual(f.store.list()[0].comments!.map((comment) => comment.authorName), ["Human"]);
  } finally { f.cleanup(); }
});

test("a failed reply is recorded and the next tagged agent still responds", async () => {
  const f = fixture(async ({ run }) => {
    if (run.kind === "intent") return '["refiner","reviewer"]';
    if (run.profile.id === "refiner") throw new Error("Reply failed");
    return "Review response";
  });
  try {
    f.store.postComment("task", "@Refiner @Reviewer");
    await f.service.drain();
    assert.deepEqual(f.store.history().map((run) => run.status), ["Complete", "Failed", "Complete"]);
    assert.equal(f.store.list()[0].comments!.at(-1)!.body, "Review response");
  } finally { f.cleanup(); }
});


test("legacy intent comments are hidden without hiding unrelated comments from an agent named Intent", async () => {
  const f = fixture(async ({ run }) => run.kind === "intent" ? '["refiner"]' : "Response");
  try {
    f.store.postComment("task", "@Refiner");
    await f.service.drain();
    const intent = f.store.history()[0];
    f.store.addComment({ id: "legacy-intent", taskId: "task", authorName: "Intent", body: intent.summary!, createdAt: intent.finishedAt! });
    f.store.addComment({ id: "unrelated", taskId: "task", authorName: "Intent", body: "An ordinary agent reply", createdAt: intent.finishedAt! });
    const comments = f.store.list()[0].comments!;
    assert.equal(comments.some((comment) => comment.id === "legacy-intent"), false);
    assert.equal(comments.some((comment) => comment.id === "unrelated"), true);
    assert.equal(f.store.history()[0].summary, intent.summary);
  } finally { f.cleanup(); }
});
