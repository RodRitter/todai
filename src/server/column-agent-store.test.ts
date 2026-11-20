import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore } from "./task-store.ts";

test("reusable agents can be assigned to multiple columns, edited, and unassigned across restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-agents-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  try {
    const task = store.save({
      id: "task",
      title: "Review work",
      description: "",
      status: "In review",
    });
    const agent = store.saveAgent({
      id: "reviewer",
      name: "Reviewer",
      tool: "codex",
      model: "custom-model",
      effort: "high",
      instructions: "Review changes.",
      permissions: "read-only",
    });
    store.assignColumnAgent({ column: "To do", agentId: agent.id });
    store.assignColumnAgent({ column: "In review", agentId: agent.id });
    store.saveAgent({ ...agent, name: "Senior reviewer" });
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listAgents(), [
      { ...agent, name: "Senior reviewer" },
    ]);
    assert.deepEqual(store.listColumnAgents(), [
      { column: "To do", agentId: "reviewer" },
      { column: "In review", agentId: "reviewer" },
    ]);
    store.assignColumnAgent({ column: "To do", agentId: null });
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listColumnAgents(), [
      { column: "In review", agentId: "reviewer" },
    ]);
    assert.equal(store.listAgents().length, 1);
    assert.deepEqual(store.list(), [task]);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("existing column settings migrate once into reusable agents without losing assignments", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const directory = mkdtempSync(join(tmpdir(), "todai-agent-migration-"));
  const path = join(directory, "tasks.sqlite");
  const legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE column_agents (column TEXT PRIMARY KEY, name TEXT, tool TEXT, model TEXT, effort TEXT, instructions TEXT, permissions TEXT);
    INSERT INTO column_agents VALUES ('In review', 'Reviewer', 'codex', 'custom-model', 'high', 'Keep these instructions', 'read-only');`);
  legacy.close();
  let store = new TaskStore(path);
  try {
    const agents = store.listAgents();
    assert.equal(agents.length, 1);
    assert.equal(agents[0].name, "Reviewer");
    assert.equal(agents[0].model, "custom-model");
    assert.equal(agents[0].instructions, "Keep these instructions");
    assert.deepEqual(store.listColumnAgents(), [
      { column: "In review", agentId: agents[0].id },
    ]);
    store.assignColumnAgent({ column: "In review", agentId: null });
    store.close();
    store = new TaskStore(path);
    assert.deepEqual(store.listAgents(), agents);
    assert.deepEqual(store.listColumnAgents(), []);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deleting an agent clears assignments while invalid settings leave saved profiles intact", () => {
  const store = new TaskStore(":memory:");
  try {
    const agent = store.saveAgent({
      id: "planner",
      name: "Planner",
      tool: "codex",
      model: "custom-model",
      effort: "medium",
      instructions: "",
      permissions: "workspace-write",
    });
    store.assignColumnAgent({ column: "To do", agentId: agent.id });
    for (const [change, message] of [
      [{ id: "" }, /ID/i],
      [{ name: " " }, /name/i],
      [{ model: "" }, /model/i],
      [{ tool: "other" }, /Codex/i],
      [{ effort: "extreme" }, /effort/i],
      [{ permissions: "all" }, /permissions/i],
      [{ instructions: null }, /instructions/i],
    ] as const) {
      assert.throws(() => store.saveAgent({ ...agent, ...change }), message);
      assert.deepEqual(store.listAgents(), [agent]);
    }
    assert.throws(
      () => store.assignColumnAgent({ column: "To do", agentId: "missing" }),
      /saved agent/i,
    );
    assert.throws(
      () => store.assignColumnAgent({ column: "Unknown", agentId: agent.id }),
      /column/i,
    );
    assert.deepEqual(store.listColumnAgents(), [
      { column: "To do", agentId: agent.id },
    ]);
    store.deleteAgent(agent.id);
    assert.deepEqual(store.listAgents(), []);
    assert.deepEqual(store.listColumnAgents(), []);
  } finally {
    store.close();
  }
});

test("edit approval persists and rejects non-boolean configuration", () => {
  const store = new TaskStore(":memory:");
  try {
    const agent = store.saveAgent({ id: "fixer", name: "Fixer", tool: "codex", model: "test", effort: "high", permissions: "workspace-write", instructions: "Fix", requireApprovalBeforeEdits: true });
    assert.equal(store.listAgents()[0].requireApprovalBeforeEdits, true);
    assert.throws(() => store.saveAgent({ ...agent, requireApprovalBeforeEdits: "false" }), /approval/);
    store.saveAgent({ ...agent, requireApprovalBeforeEdits: false });
    assert.equal(store.listAgents()[0].requireApprovalBeforeEdits, false);
  } finally { store.close(); }
});

test("existing Bug fixer profiles migrate once and keep later approval choices", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const directory = mkdtempSync(join(tmpdir(), "todai-approval-migration-"));
  const path = join(directory, "tasks.sqlite");
  let store = new TaskStore(path);
  const legacyApproval = " Mandatory: before any repair or file edit, issue the skill’s structured feedback_request and stop. Proceed only after an explicit affirmative Human answer to that specific repair proposal; automation and column entry are not approval.";
  const agent = store.saveAgent({ id: "fixer", name: "Bug fixer", tool: "codex", model: "test", effort: "high", permissions: "workspace-write", instructions: "Follow the Fix role." + legacyApproval });
  store.close();
  const db = new DatabaseSync(path);
  db.exec("ALTER TABLE agents DROP COLUMN requireApprovalBeforeEdits");
  db.close();
  store = new TaskStore(path);
  try {
    assert.deepEqual(store.listAgents(), [{ ...agent, instructions: "Follow the Fix role.", requireApprovalBeforeEdits: true }]);
    store.saveAgent({ ...store.listAgents()[0], requireApprovalBeforeEdits: false });
    store.close();
    store = new TaskStore(path);
    assert.equal(store.listAgents()[0].requireApprovalBeforeEdits, false);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
