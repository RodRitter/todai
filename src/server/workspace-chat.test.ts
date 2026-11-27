import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { WorkspaceChatStore, chatModel } from "./workspace-chat-store.ts";
import { sendWorkspaceChat } from "./workspace-chat-service.ts";
import { callWorkspaceTool, openWorkspaceChatTools } from "./workspace-chat-tools.ts";
import { workspaceChatArgs, workspaceChatPrompt } from "./workspace-chat-runner.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-workspace-chat-test-"));
  const path = join(directory, "tasks.sqlite"), tasks = new TaskStore(path), chats = new WorkspaceChatStore(tasks);
  return { directory, path, tasks, chats, close() { chats.close(); tasks.close(); rmSync(directory, { recursive: true, force: true }); } };
}
const model = { tool: "codex", model: "gpt-6.1-sol", effort: "high" };
const profile = { name: "Reviewer", tool: "codex", model: "gpt-6.1-sol", effort: "medium", permissions: "read-only", instructions: "Review tasks." };

test("workspace conversations persist models and effort without tasks or custom chat agents", async () => {
  const f = fixture();
  try {
    const before = f.tasks.listAgents(), session = f.chats.create();
    const response = await sendWorkspaceChat(f.tasks, f.chats, session.id, "Explain columns", model, async request => {
      assert.equal(request.kind, "workspace-chat"); assert.equal(request.session.effort, "high");
      request.onUsage({ input_tokens: 1000, cached_input_tokens: 0, output_tokens: 200 });
      return "Columns organize tasks.";
    });
    assert.equal(response.messages.length, 2); assert.equal(response.title, "Explain columns");
    assert.equal(response.messages[1].effort, "high"); assert.equal(response.running, false);
    assert.equal(f.tasks.usage().workspaceCredits().calls, 1); assert.equal(f.tasks.usage().taskCredits().size, 0);
    assert.deepEqual(f.tasks.list(), []); assert.deepEqual(f.tasks.listAgents(), before);
    const reload = new WorkspaceChatStore(f.tasks);
    try { assert.deepEqual(reload.get(session.id), response); } finally { reload.close(); }
    await sendWorkspaceChat(f.tasks, f.chats, session.id, "And boards?", { tool: "claude", model: "sonnet", effort: "max" }, async () => "Boards contain columns.");
    assert.equal(f.chats.get(session.id).effort, "max"); assert.equal(f.chats.get(session.id).messages[1].model, "gpt-6.1-sol");
    assert.notEqual(f.chats.create().id, session.id);
    assert.equal(f.chats.rename(session.id, "Board guide").title, "Board guide");
    f.chats.delete(session.id); assert.throws(() => f.chats.get(session.id), /not found/);
  } finally { f.close(); }
});
test("leases reject duplicates and lifecycle changes; restart recovery and credit limits work", () => {
  const f = fixture();
  try {
    const session = f.chats.create(), { lease } = f.chats.begin(session.id, "Hello", model);
    assert.throws(() => f.chats.begin(session.id, "Again", model), /current response/);
    assert.throws(() => f.chats.delete(session.id), /Wait/);
    assert.throws(() => f.tasks.setWorkspaceArchived(f.tasks.workspaceId, true), /chats/);
    assert.throws(() => f.tasks.setWorkspacePath(f.directory), /chats/);
    const db = new DatabaseSync(f.path);
    db.prepare("UPDATE workspace_chats SET ownerIdentity = 'old-process' WHERE id = ?").run(session.id); db.close();
    const recovered = new WorkspaceChatStore(f.tasks);
    try { assert.equal(recovered.get(session.id).running, false); assert.match(recovered.get(session.id).error!, /interrupted/); } finally { recovered.close(); }
    assert.throws(() => f.chats.assertLease(session.id, lease), /expired/);
    f.tasks.setCreditLimit(1); f.tasks.usage().setTrackedCredits(1);
    assert.throws(() => f.chats.begin(session.id, "Hello", model), /credit limit/);
    assert.throws(() => chatModel({ ...model, effort: "max" }), /effort/);
  } finally { f.close(); }
});
test("management tools preserve validation, updates, assignments and workspace boundaries", () => {
  const f = fixture();
  try {
    const board = callWorkspaceTool(f.tasks, "create_board", { name: "Review" }) as { id: string };
    const agent = callWorkspaceTool(f.tasks, "create_agent", profile) as { id: string };
    assert.equal((callWorkspaceTool(f.tasks, "update_agent", { id: agent.id, name: "QA" }) as { instructions: string }).instructions, profile.instructions);
    callWorkspaceTool(f.tasks, "create_column", { boardId: board.id, name: "QA" });
    callWorkspaceTool(f.tasks, "assign_column_agent", { boardId: board.id, column: "QA", agentId: agent.id });
    callWorkspaceTool(f.tasks, "update_column", { boardId: board.id, column: "QA", name: "Quality", instructions: "Check results", completion: true });
    const columns = callWorkspaceTool(f.tasks, "list_columns", { boardId: board.id }) as { name: string; instructions: string; completion: boolean; agentId: string | null }[];
    assert.deepEqual(columns.at(-1), { name: "Quality", instructions: "Check results", completion: true, agentId: agent.id });
    const order = columns.map(column => column.name).reverse();
    assert.deepEqual((callWorkspaceTool(f.tasks, "reorder_columns", { boardId: board.id, columns: order }) as typeof columns).map(column => column.name), order);
    assert.throws(() => callWorkspaceTool(f.tasks, "reorder_columns", { boardId: board.id, columns: ["Quality"] }), /every existing column/);
    callWorkspaceTool(f.tasks, "assign_column_agent", { boardId: board.id, column: "Quality", agentId: null });
    callWorkspaceTool(f.tasks, "delete_column", { boardId: board.id, column: "Quality" });
    callWorkspaceTool(f.tasks, "rename_board", { boardId: board.id, name: "Delivery" });
    callWorkspaceTool(f.tasks, "delete_agent", { id: agent.id });
    assert.throws(() => callWorkspaceTool(f.tasks, "read_agent", { id: agent.id }), /Choose an agent/);
    assert.throws(() => callWorkspaceTool(f.tasks, "delete_board", { boardId: f.tasks.workspaceId }), /default board/);
    assert.throws(() => callWorkspaceTool(f.tasks, "create_column", { name: "No board" }), /boardId/);
    assert.throws(() => callWorkspaceTool(f.tasks, "create_column", { boardId: board.id, name: "QA", workspaceId: "foreign" }), /Unknown/);
    const foreign = f.tasks.createWorkspace("Other", f.directory);
    assert.throws(() => callWorkspaceTool(f.tasks, "list_columns", { boardId: foreign.id }), /this workspace/);
    const session = f.chats.create(), other = new TaskStore(f.path, foreign.id), otherChats = new WorkspaceChatStore(other);
    try { assert.throws(() => otherChats.get(session.id), /not found/); assert.throws(() => otherChats.rename(session.id, "Stolen"), /not found/); } finally { otherChats.close(); other.close(); }
    callWorkspaceTool(f.tasks, "delete_board", { boardId: board.id });
  } finally { f.close(); }
});
test("MCP requires authentication and active leases; partial changes survive response failures", async () => {
  const f = fixture();
  try {
    const session = f.chats.create(); let url = "", token = "";
    const response = await sendWorkspaceChat(f.tasks, f.chats, session.id, "Create Review", model, async request => {
      ({ url, token } = request.connection);
      const call = async (method: string, params?: unknown, authorization = `Bearer ${token}`) => fetch(url, { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      assert.equal((await call("tools/list", undefined, "wrong")).status, 403);
      const list = await (await call("tools/list")).json(); assert.ok(list.result.tools.some((tool: { name: string }) => tool.name === "create_board"));
      assert.equal((await (await call("tools/call", { name: "create_board", arguments: { name: "Review" } })).json()).result.isError, undefined);
      assert.equal((await (await call("tools/call", { name: "delete_board", arguments: { boardId: f.tasks.workspaceId } })).json()).result.isError, true);
      throw new Error("Model disconnected.");
    });
    assert.equal(response.error, "Model disconnected."); assert.equal(response.activities.length, 2);
    assert.equal(response.activities[0].status, "complete"); assert.equal(response.activities[1].status, "error");
    assert.ok(f.tasks.listBoards().some(board => board.name === "Review"));
    await assert.rejects(fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } }));
    const controller = new AbortController();
    const server = await openWorkspaceChatTools(f.tasks, controller.signal, () => { throw new Error("expired"); }, "turn", () => {});
    try { assert.equal((await fetch(server.connection.url, { method: "POST", headers: { Authorization: `Bearer ${server.connection.token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) })).status, 400); } finally { server.close(); }
  } finally { f.close(); }
});
test("both runner configurations expose only management tools and selected model/effort", () => {
  const f = fixture();
  try {
    const session = { ...f.chats.create(), effort: "high" as const }, connection = { url: "http://127.0.0.1:1234/mcp", token: "test-token" };
    const request = { kind: "workspace-chat" as const, session, connection, signal: new AbortController().signal, onUsage: () => {} };
    const codex = workspaceChatArgs(request, "/tmp/isolated", "/tmp/output");
    assert.ok(codex.includes("shell_tool")); assert.ok(codex.includes("mcp_servers={}")); assert.ok(codex.includes("read-only")); assert.ok(codex.includes('model_reasoning_effort="high"'));
    const claude = workspaceChatArgs({ ...request, session: { ...session, tool: "claude", model: "opus" } }, "/tmp/isolated", "/tmp/output");
    assert.equal(claude[claude.indexOf("--tools") + 1], ""); assert.ok(claude.includes("--strict-mcp-config")); assert.ok(claude.includes("mcp__todai_workspace")); assert.ok(claude.includes("opus")); assert.ok(claude.includes("high"));
    assert.match(workspaceChatPrompt(session), /no custom agent role/);
  } finally { f.close(); }
});

test("model and effort changes save before sending and cannot race an active response", () => {
  const f = fixture();
  try {
    const session = f.chats.create();
    const changed = f.chats.setModel(session.id, { tool: "claude", model: "opus", effort: "max" });
    assert.equal(changed.effort, "max"); assert.equal(f.chats.get(session.id).model, "opus");
    const { lease } = f.chats.begin(session.id, "Hello", model);
    assert.throws(() => f.chats.setModel(session.id, model), /Wait/);
    f.chats.finish(session.id, lease, "Hello");
  } finally { f.close(); }
});

test("legacy usage migration preserves task history and permits workspace usage", async () => {
  const { initializeUsageSchema, UsageStore } = await import("./usage-store.ts");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE workspaces (id TEXT PRIMARY KEY);
      CREATE TABLE tasks (id TEXT PRIMARY KEY, workspaceId TEXT, archivedAt TEXT);
      CREATE TABLE runs (id TEXT, workspaceId TEXT, taskId TEXT, profile TEXT, status TEXT, startedAt TEXT);
      CREATE TABLE settings (workspaceId TEXT, key TEXT, value TEXT);
      INSERT INTO workspaces VALUES ('workspace'); INSERT INTO tasks VALUES ('task', 'workspace', NULL);
      CREATE TABLE task_usage (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), taskId TEXT NOT NULL REFERENCES tasks(id), runId TEXT,
        agentName TEXT NOT NULL, model TEXT NOT NULL, kind TEXT NOT NULL, startedAt TEXT NOT NULL, finishedAt TEXT,
        outcome TEXT NOT NULL, complete INTEGER NOT NULL DEFAULT 0, tokens TEXT, rate TEXT, credits REAL, ownerPid INTEGER, ownerIdentity TEXT);
      INSERT INTO task_usage (id, workspaceId, taskId, agentName, model, kind, startedAt, outcome, credits) VALUES ('legacy', 'workspace', 'task', 'Agent', 'old-model', 'chat', '2026-01-01', 'Complete', 5);`);
    initializeUsageSchema(db); initializeUsageSchema(db);
    const usage = new UsageStore(db, "workspace");
    usage.beginWorkspaceChat("new", "gpt-6.1-sol", "high"); usage.finish("new", "Complete");
    assert.equal(usage.workspaceCredits().credits, 5); assert.equal(usage.workspaceCredits().calls, 2);
    assert.equal(usage.taskCredits().get("task")!.calls, 1); assert.equal(usage.taskCredits().size, 1);
    assert.equal(db.prepare("SELECT taskId FROM task_usage WHERE id = 'legacy'").get()!.taskId, "task");
  } finally { db.close(); }
});

test("workspace chat HTTP routes enforce ownership and persist titles and selections", async () => {
  const routes = await import("../app/api/workspace-chats/route.ts");
  const f = fixture(), previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = f.path;
  const request = (method: string, body?: unknown, workspace = f.tasks.workspaceId, query = "") => new Request(`http://localhost/api/workspace-chats${query}`, { method, headers: { "X-Todai-Workspace": workspace, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const created = await routes.POST(request("POST", { action: "create" })); assert.equal(created.status, 201);
    const session = await created.json();
    assert.equal((await (await routes.PATCH(request("PATCH", { id: session.id, title: "Notes" }))).json()).title, "Notes");
    assert.equal((await (await routes.PATCH(request("PATCH", { action: "model", id: session.id, ...model }))).json()).effort, "high");
    const foreign = f.tasks.createWorkspace("Other", f.directory);
    assert.equal((await routes.GET(request("GET", undefined, foreign.id, `?id=${session.id}`))).status, 400);
    assert.equal((await routes.DELETE(request("DELETE", { id: session.id }, foreign.id))).status, 400);
    assert.equal((await routes.GET(new Request("http://localhost/api/workspace-chats"))).status, 400);
    assert.equal((await routes.DELETE(request("DELETE", { id: session.id }))).status, 204);
  } finally { if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous; f.close(); }
});

test("expired workspace usage recovers before a new chat takes the database lock", () => {
  const f = fixture();
  try {
    const usage = f.tasks.usage(); usage.beginWorkspaceChat("expired", "gpt-6.1-sol", "medium");
    const db = new DatabaseSync(f.path);
    db.prepare("UPDATE task_usage SET startedAt = '2000-01-01T00:00:00Z' WHERE id = 'expired'").run();
    f.tasks.setCreditLimit(100);
    const session = f.chats.create(), { lease } = f.chats.begin(session.id, "Hello", model);
    assert.equal(db.prepare("SELECT outcome FROM task_usage WHERE id = 'expired'").get()!.outcome, "Interrupted");
    f.chats.finish(session.id, lease, "Hello"); db.close();
  } finally { f.close(); }
});
