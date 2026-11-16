import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";

test("created columns and their order survive reopening without resetting defaults", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-columns-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  try {
    assert.deepEqual(store.listColumns(), [
      "To do",
      "In progress",
      "In review",
      "Done",
    ]);
    store.createColumn("  Planning  ");
    store.reorderColumns([
      "Planning",
      "Done",
      "To do",
      "In progress",
      "In review",
    ]);
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listColumns(), [
      "Planning",
      "Done",
      "To do",
      "In progress",
      "In review",
    ]);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("custom columns accept tasks and agents, and reordering preserves their work", () => {
  const store = new TaskStore(":memory:");
  try {
    store.createColumn("Planning");
    const agent = store.saveAgent({
      id: "planner",
      name: "Planner",
      tool: "codex",
      model: "custom-model",
      effort: "medium",
      instructions: "",
      permissions: "read-only",
    });
    store.assignColumnAgent({ column: "Planning", agentId: agent.id });
    const task = store.save({
      id: "one",
      title: "Plan work",
      description: "",
      status: "Planning",
    });
    assert.equal(task.agentStatus, "Queued");
    store.reorderColumns([
      "Planning",
      "To do",
      "In progress",
      "In review",
      "Done",
    ]);
    assert.deepEqual(store.list(), [task]);
    assert.deepEqual(store.listColumnAgents(), [
      { column: "Planning", agentId: "planner" },
    ]);
    assert.equal(store.history().length, 1);
    assert.equal(store.history()[0].column, "Planning");
    assert.throws(
      () => store.save({ ...task, status: "Missing" }),
      /valid task/,
    );
  } finally {
    store.close();
  }
});

test("invalid names and stale or incomplete reorders leave columns intact", () => {
  const store = new TaskStore(":memory:");
  try {
    for (const name of ["", "  ", null, "to DO", "x".repeat(81)]) {
      assert.throws(() => store.createColumn(name), /column|name/i);
    }
    store.createColumn("Planning");
    for (const order of [
      null,
      [],
      ["To do", "In progress", "In review", "Done"],
      ["To do", "In progress", "In review", "Done", "Done"],
      ["To do", "In progress", "In review", "Done", "Unknown"],
    ]) {
      assert.throws(() => store.reorderColumns(order), /every existing column/);
      assert.deepEqual(store.listColumns(), [
        "To do",
        "In progress",
        "In review",
        "Done",
        "Planning",
      ]);
    }
  } finally {
    store.close();
  }
});

test("renaming a column preserves tasks, assignments and queued work across restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-rename-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  try {
    store.saveAgent({
      id: "planner",
      name: "Planner",
      tool: "codex",
      model: "custom-model",
      effort: "medium",
      instructions: "",
      permissions: "read-only",
    });
    store.assignColumnAgent({ column: "To do", agentId: "planner" });
    store.save({
      id: "one",
      title: "Plan work",
      description: "",
      status: "To do",
    });
    store.renameColumn("To do", "  Backlog  ");
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listColumns(), [
      "Backlog",
      "In progress",
      "In review",
      "Done",
    ]);
    assert.equal(store.list()[0].status, "Backlog");
    assert.deepEqual(store.boardSnapshot(), {
      tasks: store.list(),
      columns: ["Backlog", "In progress", "In review", "Done"],
      assignments: [{ column: "Backlog", agentId: "planner" }],
    });
    assert.equal(store.list()[0].agentStatus, "Queued");
    assert.deepEqual(store.listColumnAgents(), [
      { column: "Backlog", agentId: "planner" },
    ]);
    assert.equal(store.history().length, 1);
    assert.equal(store.history()[0].column, "Backlog");
    assert.throws(
      () => store.renameColumn("Backlog", "Done"),
      /already exists/,
    );
    assert.throws(() => store.renameColumn("Backlog", " "), /name/);
    assert.throws(() => store.renameColumn("Missing", "New"), /existing/);
    assert.equal(store.list()[0].status, "Backlog");
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deleting empty columns clears assignments, preserves agents, and never deletes tasks or the last column", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-delete-column-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  try {
    const task = store.save({
      id: "one",
      title: "Keep work",
      description: "",
      status: "To do",
    });
    store.saveAgent({
      id: "planner",
      name: "Planner",
      tool: "codex",
      model: "custom-model",
      effort: "medium",
      instructions: "",
      permissions: "read-only",
    });
    store.assignColumnAgent({ column: "In progress", agentId: "planner" });
    assert.throws(() => store.deleteColumn("To do"), /Move.*tasks/);
    store.deleteColumn("In progress");
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listColumns(), ["To do", "In review", "Done"]);
    assert.deepEqual(store.listColumnAgents(), []);
    assert.equal(store.listAgents().length, 1);
    assert.deepEqual(store.list(), [task]);
    store.createColumn("Planning");
    assert.deepEqual(store.listColumns(), [
      "To do",
      "In review",
      "Done",
      "Planning",
    ]);
    store.deleteColumn("In review");
    store.deleteColumn("Done");
    store.deleteColumn("Planning");
    store.delete("one");
    assert.throws(() => store.deleteColumn("To do"), /at least one/);
    assert.throws(() => store.deleteColumn("Missing"), /existing/);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
