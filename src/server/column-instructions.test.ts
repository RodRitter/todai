import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore } from "./task-store.ts";
import { agentPrompt } from "./agent-prompt.ts";

const agent = { id: "builder", name: "Builder", tool: "codex", model: "test", effort: "medium", instructions: "Agent role", permissions: "read-only" };

test("column settings survive rename, reorder, export, import, and database reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-column-settings-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  const target = new TaskStore(":memory:");
  try {
    store.createColumn("Validate");
    store.renameColumn("Validate", "Review", "Check acceptance criteria.\nRecord evidence.");
    store.reorderColumns(["Review", ...store.listColumns().filter((column) => column !== "Review")]);
    store.close(); store = new TaskStore(path);
    assert.equal(store.columnInstructions().Review, "Check acceptance criteria.\nRecord evidence.");
    target.importConfiguration(store.exportConfiguration(), "replace");
    assert.equal(target.columnInstructions().Review, store.columnInstructions().Review);
    store.renameColumn("Review", "Review", "");
    assert.equal(store.columnInstructions().Review, "");
    store.deleteColumn("Review"); store.createColumn("Review");
    assert.equal(store.columnInstructions().Review, "");
    assert.throws(() => store.renameColumn("Review", "Changed", 123), /instructions/);
    assert.ok(store.listColumns().includes("Review"));
  } finally { store.close(); target.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("runs capture instructions from the task board at start and preserve the snapshot", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-column-runs-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  const board = store.saveBoard("Other");
  const other = new TaskStore(path, store.workspaceId, { boardId: board.id });
  try {
    store.saveAgent(agent);
    store.renameColumn("In progress", "In progress", "Wrong board");
    other.renameColumn("In progress", "In progress", "Before queue");
    other.assignColumnAgent({ column: "In progress", agentId: agent.id });
    const task = other.save({ id: "task", title: "Task", description: "", status: "In progress", autoRun: true });
    other.renameColumn("In progress", "In progress", "Stage instructions");
    const run = store.claimRun()!;
    assert.equal(run.columnInstructions, "Stage instructions");
    other.renameColumn("In progress", "In progress", "Later instructions");
    assert.equal(store.history(task.id)[0].columnInstructions, "Stage instructions");
    const request = { run, task, workspace: directory, signal: new AbortController().signal, onStart() {} };
    for (const kind of [undefined, "reply"] as const) {
      const prompt = agentPrompt({ ...request, run: { ...run, kind } });
      assert.match(prompt, /Agent role/);
      assert.match(prompt, /Stage instructions/);
      assert.doesNotMatch(prompt, /Wrong board|Later instructions/);
    }
    assert.doesNotMatch(agentPrompt({ ...request, run: { ...run, kind: "intent" } }), /Stage instructions/);
    store.finishRun(run.id, "Complete", "Done");
    assert.equal(other.list().find((item) => item.id === task.id)?.status, "In progress");
  } finally { other.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});
