import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { parseConfiguration, selectConfiguration } from "../domain/configuration.ts";

function seed(store: TaskStore) {
  store.saveAgent({ id: "agent", name: "Reviewer", tool: "codex", model: "custom", effort: "high", instructions: "Review", permissions: "read-only" });
  store.saveAgent({ id: "other", name: "Reviewer", tool: "codex", model: "custom", effort: "low", instructions: "", permissions: "read-only" });
  store.assignColumnAgent({ column: "To do", agentId: "agent" });
  return store.exportConfiguration();
}

test("individual selection keeps columns but drops assignments for omitted agents", () => {
  const store = new TaskStore(":memory:");
  try {
    const data = seed(store);
    const ids = data.columns.map((column) => column.id);
    const selected = selectConfiguration(data, ["other"], ids);
    assert.deepEqual(selected.columns, data.columns);
    assert.deepEqual(selected.assignments, []);
    assert.deepEqual(selected.agents.map((agent) => agent.id), ["other"]);
    assert.deepEqual(selectConfiguration(data, [], ids).assignments, []);
    assert.deepEqual(selectConfiguration(data, ["agent"], []).columns, []);
    assert.equal(selectConfiguration(data, ["agent"], ids).assignments.length, 1);
    assert.deepEqual(parseConfiguration(JSON.parse(JSON.stringify(data))), data);
  } finally { store.close(); }
});

test("repeated imports create unique agents and columns and remap assignments without changing tasks", () => {
  const store = new TaskStore(":memory:");
  try {
    const data = seed(store);
    store.save({ id: "task", title: "Existing", description: "", status: "Done" });
    const tasks = store.list();
    for (let i = 0; i < 2; i++) store.importConfiguration(data);
    const result = store.exportConfiguration();
    assert.equal(result.agents.length, 6);
    assert.equal(new Set(result.agents.map((agent) => agent.id)).size, 6);
    assert.equal(result.columns.length, 12);
    assert.equal(new Set(result.columns.map((column) => column.id)).size, 12);
    assert.equal(new Set(result.columns.map((column) => column.name)).size, 12);
    assert.equal(result.assignments.length, 3);
    assert.equal(new Set(result.assignments.map((assignment) => assignment.agentId)).size, 3);
    assert.equal(new Set(result.assignments.map((assignment) => assignment.columnId)).size, 3);
    assert.deepEqual(result.agents.slice(0, 2), data.agents);
    assert.deepEqual(store.list(), tasks);
  } finally { store.close(); }
});

test("agents-only and columns-only imports do not create assignments", () => {
  const source = new TaskStore(":memory:");
  const target = new TaskStore(":memory:");
  try {
    const data = seed(source);
    target.importConfiguration(selectConfiguration(data, ["agent"], []));
    assert.equal(target.listColumns().length, 4);
    target.importConfiguration(selectConfiguration(data, [], data.columns.map((column) => column.id)));
    assert.equal(target.listAgents().length, 1);
    assert.equal(target.listColumns().length, 8);
    assert.deepEqual(target.listColumnAgents(), []);
  } finally { source.close(); target.close(); }
});

test("invalid references, duplicate IDs, and unsupported versions leave the database unchanged", () => {
  const store = new TaskStore(":memory:");
  try {
    const data = seed(store);
    for (const invalid of [
      { ...data, version: 2 },
      { ...data, agents: [data.agents[0], data.agents[0]] },
      { ...data, columns: [data.columns[0], { ...data.columns[0], name: "Other" }] },
      { ...data, assignments: [{ columnId: "missing", agentId: "agent" }] },
      { ...data, assignments: [{ columnId: data.columns[0].id, agentId: "missing" }] },
    ]) {
      assert.throws(() => store.importConfiguration(invalid));
      assert.deepEqual(store.exportConfiguration(), data);
    }
  } finally { store.close(); }
});

test("column IDs survive renames and restart; database failure rolls back the entire import", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-transfer-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  try {
    const data = seed(store);
    store.renameColumn("To do", "Backlog");
    store.close();
    store = new TaskStore(path);
    assert.equal(store.exportConfiguration().columns[0].id, data.columns[0].id);
    const before = store.exportConfiguration();
    const db = new DatabaseSync(path);
    db.exec("CREATE TRIGGER reject_column BEFORE INSERT ON board_columns BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    db.close();
    assert.throws(() => store.importConfiguration(data), /test failure/);
    assert.deepEqual(store.exportConfiguration(), before);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("replace removes old columns and assignments while preserving tasks and agents", () => {
  const store = new TaskStore(":memory:");
  try {
    const data = seed(store);
    store.save({ id: "task", title: "Keep me", description: "", status: "Done" });
    const selected = selectConfiguration(data, [], [data.columns[1].id]);
    store.importConfiguration(selected, "replace");
    assert.deepEqual(store.listColumns(), ["In progress"]);
    assert.deepEqual(store.listColumnAgents(), []);
    assert.equal(store.list()[0].status, "In progress");
    assert.equal(store.list()[0].title, "Keep me");
    assert.equal(store.listAgents().length, 2);
    assert.notEqual(store.exportConfiguration().columns[0].id, selected.columns[0].id);
  } finally { store.close(); }
});

test("explicit overwrite matches IDs, keeps tasks attached, and clears omitted assignments", () => {
  const store = new TaskStore(":memory:");
  try {
    const data = seed(store);
    store.save({ id: "task", title: "Keep me", description: "", status: "Done" });
    const changed = { ...data, agents: [{ ...data.agents[0], name: "Updated" }], columns: data.columns.map((column) => ({ ...column, name: column.name === "Done" ? "Finished" : column.name })), assignments: [] };
    store.importConfiguration(changed, "add", "overwrite");
    assert.equal(store.listAgents().length, 2);
    assert.equal(store.listAgents()[0].name, "Updated");
    assert.equal(store.listAgents()[1].name, "Reviewer");
    assert.equal(store.listColumns().length, 4);
    assert.equal(store.list()[0].status, "Finished");
    assert.deepEqual(store.listColumnAgents(), []);
    assert.deepEqual(store.exportConfiguration().columns.map((column) => column.id), data.columns.map((column) => column.id));
  } finally { store.close(); }
});

test("replacement and column overwrites are blocked while work is queued", () => {
  const store = new TaskStore(":memory:");
  try {
    const data = seed(store);
    store.save({ id: "task", title: "Queued", autoRun: true, description: "", status: "To do" });
    for (const mode of ["replace", "add"] as const) {
      assert.throws(() => store.importConfiguration(data, mode, "overwrite"), /runs to finish/);
      assert.deepEqual(store.exportConfiguration(), data);
    }
  } finally { store.close(); }
});
