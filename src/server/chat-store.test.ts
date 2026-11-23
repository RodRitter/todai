import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { ChatStore } from "./chat-store.ts";
import { sendChat } from "./chat-service.ts";
import { agentPrompt } from "./agent-prompt.ts";
import { commentReference, commentChatDraft, referencedCommentIds } from "../domain/comment-reference.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-chat-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  tasks.setWorkspacePath(directory);
  tasks.saveAgent({ id: "author", name: "Author", tool: "codex", model: "test", effort: "medium", permissions: "workspace-write", instructions: "Explain the task." });
  tasks.saveAgent({ id: "reviewer", name: "Reviewer", tool: "codex", model: "test", effort: "low", permissions: "read-only", instructions: "Review the task." });
  tasks.save({ id: "task", title: "Task title", description: "Full task context", status: "To do" });
  tasks.addComment({ id: "source", taskId: "task", body: "Source comment", authorName: "Author", createdAt: new Date().toISOString() });
  const chats = new ChatStore(tasks);
  return { tasks, chats, directory, path, cleanup() { chats.close(); tasks.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("one task stream survives reload and keeps chat out of task context", async () => {
  const f = fixture();
  try {
    const before = f.tasks.list();
    const session = f.chats.forTask("task");
    assert.equal(f.chats.forTask("task").id, session.id);
    const calls: string[] = [];
    await sendChat(f.tasks, f.chats, "task", "@Author explain this", async (request) => {
      calls.push(request.run.profile.id);
      assert.equal(request.run.profile.permissions, "read-only");
      assert.match(agentPrompt(request), /@Author explain this/);
      assert.doesNotMatch(agentPrompt(request), /automatically posted as a comment/);
      return request.privateChat?.candidates ? '["author"]' : "Private answer";
    });
    await sendChat(f.tasks, f.chats, "task", "Why?", async (request) => {
      assert.equal(request.privateChat?.candidates, undefined);
      assert.equal(request.run.profile.id, "task-chat-generic");
      assert.equal(request.run.profile.instructions, "");
      assert.equal(request.privateChat?.messages.length, 3);
      return "Second answer";
    });
    assert.deepEqual(calls, ["comment-intent", "author"]);
    assert.deepEqual(f.tasks.list(), before);
    assert.equal(f.tasks.history().length, 0);
    const reloaded = new ChatStore(f.tasks);
    try { assert.equal(reloaded.forTask("task").messages.length, 4); } finally { reloaded.close(); }
  } finally { f.cleanup(); }
});

test("untagged messages get a generic response without configured agents", async () => {
  for (const tool of ["codex", "claude"] as const) {
    const f = fixture();
    try {
      for (const agent of f.tasks.listAgents()) f.tasks.deleteAgent(agent.id);
      f.tasks.setDefaultExecutor(tool);
      let calls = 0;
      const result = await sendChat(f.tasks, f.chats, "task", "What is this task about?", async (request) => {
        calls++;
        assert.equal(request.privateChat?.candidates, undefined);
        assert.equal(request.run.profile.name, "Agent");
        assert.equal(request.run.profile.instructions, "");
        assert.equal(request.run.profile.tool, tool);
        assert.equal(request.run.profile.permissions, tool === "codex" ? "workspace-write" : "dontAsk");
        assert.match(agentPrompt(request), /Full task context/);
        assert.match(agentPrompt(request), /standard agent tools/);
        assert.ok(request.artifacts);
        return "A generic answer";
      });
      assert.equal(calls, 1);
      assert.equal(result.error, null);
      assert.equal(result.messages.at(-1)?.body, "A generic answer");
      assert.equal(result.messages.at(-1)?.authorName, "Agent");
    } finally { f.cleanup(); }
  }
});

test("tagged notes and comment references remain unanswered", async () => {
  const f = fixture();
  try {
    let calls = 0;
    const runner = async () => { calls++; return "[]"; };
    await sendChat(f.tasks, f.chats, "task", "I agree with @Author.", runner);
    const source = f.tasks.list()[0].comments![0];
    const result = await sendChat(f.tasks, f.chats, "task", commentChatDraft(source, f.tasks.listAgents()), runner);
    assert.equal(calls, 2);
    assert.equal(result.messages.length, 2);
    assert.equal(result.running, false);
    assert.equal(result.error, null);
  } finally { f.cleanup(); }
});

test("untagged comment references use a generic agent; tagged agents reply in intent order", async () => {
  const f = fixture();
  try {
    const source = f.tasks.list()[0].comments![0];
    await sendChat(f.tasks, f.chats, "task", `${commentReference(source)} Please explain.`, async (request) => {
      assert.equal(request.privateChat?.candidates, undefined);
      assert.equal(request.run.profile.id, "task-chat-generic");
      assert.equal(request.run.profile.instructions, "");
      assert.match(agentPrompt(request), /Source comment/);
      assert.doesNotMatch(agentPrompt(request), /Explain the task\.|Review the task\./);
      return "An explanation";
    });
    const result = await sendChat(f.tasks, f.chats, "task", "@Author @Reviewer please discuss this", async (request) => {
      if (request.privateChat?.candidates) return '["reviewer", "author"]';
      if (request.run.profile.id === "author") assert.equal(request.privateChat?.messages.at(-1)?.authorName, "Reviewer");
      return `Answer from ${request.run.profile.name}`;
    });
    assert.deepEqual(result.messages.slice(-2).map((message) => message.agentId), ["reviewer", "author"]);
  } finally { f.cleanup(); }
});

test("intent failures do not start replies and recovery keeps the saved message", async () => {
  const f = fixture();
  try {
    let calls = 0;
    const failed = await sendChat(f.tasks, f.chats, "task", "@Author explain", async () => { calls++; return '["unknown"]'; });
    assert.equal(calls, 1);
    assert.equal(failed.messages.length, 1);
    assert.match(failed.error!, /unique selected/);
    const recovered = await sendChat(f.tasks, f.chats, "task", "Please try again", async (request) => request.privateChat?.candidates ? '["author"]' : "Recovered");
    assert.equal(recovered.error, null);
    assert.equal(recovered.messages.length, 3);
  } finally { f.cleanup(); }
});

test("leases reject duplicate sends, stale replies, and allow recovery after expiry", () => {
  const f = fixture();
  try {
    assert.throws(() => f.chats.begin("task", " "), /Enter a message/);
    const turn = f.chats.begin("task", "First");
    assert.throws(() => f.chats.begin("task", "Duplicate"), /already processing/);
    const agent = f.tasks.listAgents()[0];
    assert.throws(() => f.chats.append(turn.session.id, "wrong", "Stale", agent), /expired/);
    f.chats.finish(turn.session.id, "wrong", "Stale error");
    assert.equal(f.chats.get(turn.session.id).running, true);
    const db = new DatabaseSync(f.path);
    db.prepare("UPDATE chat_sessions SET lease = ? WHERE id = ?").run("2000-01-01T00:00:00Z", turn.session.id);
    db.close();
    assert.match(f.chats.get(turn.session.id).error!, /interrupted/);
    const recovered = f.chats.begin("task", "Continue");
    f.chats.finish(recovered.session.id, recovered.lease);
    assert.equal(f.chats.get(turn.session.id).messages.length, 2);
  } finally { f.cleanup(); }
});

test("workspace and task scope prevent chat access across boundaries", () => {
  const f = fixture();
  try {
    const session = f.chats.forTask("task");
    const other = f.tasks.createWorkspace("Other", f.directory);
    const tasks = new TaskStore(f.path, other.id);
    const chats = new ChatStore(tasks);
    try {
      assert.throws(() => chats.forTask("task"), /no longer exists/);
      assert.throws(() => chats.get(session.id), /not found/);
      assert.throws(() => chats.begin("task", "Leak"), /no longer exists/);
      assert.throws(() => f.chats.get(session.id, "other"), /not found in this task/);
    } finally { chats.close(); tasks.close(); }
    f.tasks.delete("task");
    assert.throws(() => f.chats.get(session.id), /not found/);
  } finally { f.cleanup(); }
});

test("comment references encode IDs and do not resolve another task or code samples", () => {
  const source = { id: "source/a", taskId: "task/b", body: "", authorName: "Author", createdAt: "" };
  const ref = commentReference(source);
  assert.deepEqual(referencedCommentIds(ref, source.taskId), [source.id]);
  assert.deepEqual(referencedCommentIds(ref, "other"), []);
  assert.deepEqual(referencedCommentIds(`\`${ref}\``, source.taskId), []);
});

test("legacy sessions merge once without losing messages or source comments", () => {
  const f = fixture();
  try {
    const db = new DatabaseSync(f.path);
    db.exec(`DROP INDEX chat_task;
      ALTER TABLE chat_sessions ADD COLUMN commentId TEXT;
      ALTER TABLE chat_sessions ADD COLUMN title TEXT;
      ALTER TABLE chat_sessions ADD COLUMN profile TEXT;
      ALTER TABLE chat_sessions ADD COLUMN source TEXT;`);
    const profile = f.tasks.listAgents().find((agent) => agent.id === "author")!;
    for (const [id, time] of [["old-one", "2026-01-01"], ["old-two", "2026-01-02"]]) {
      db.prepare("INSERT INTO chat_sessions (id, workspaceId, taskId, createdAt, updatedAt, commentId, title, profile, source) VALUES (?, ?, 'task', ?, ?, 'source', 'Old chat', ?, ?)")
        .run(id, f.tasks.workspaceId, time, time, JSON.stringify(profile), JSON.stringify({ body: `Source for ${id}`, authorName: "Author" }));
      db.prepare("INSERT INTO chat_messages (id, sessionId, authorName, body, createdAt) VALUES (?, ?, 'Human', ?, ?)").run(`message-${id}`, id, `Message in ${id}`, time);
    }
    db.close();
    for (let repeat = 0; repeat < 2; repeat++) {
      const tasks = new TaskStore(f.path);
      const chats = new ChatStore(tasks);
      try {
        const result = chats.forTask("task");
        assert.equal(result.messages.length, 4);
        assert.equal(result.messages.filter((message) => message.body.startsWith("Source comment")).length, 2);
        assert.equal(result.messages.filter((message) => message.body.startsWith("Message in")).length, 2);
      } finally { chats.close(); tasks.close(); }
    }
  } finally { f.cleanup(); }
});

test("deleting Human and agent messages persists and does not change task activity", () => {
  const f = fixture();
  try {
    const before = f.tasks.list();
    const turn = f.chats.begin("task", "Question");
    const author = f.tasks.listAgents()[0];
    f.chats.append(turn.session.id, turn.lease, "Answer", author);
    f.chats.finish(turn.session.id, turn.lease);
    const messages = f.chats.get(turn.session.id).messages;
    assert.equal(f.chats.deleteMessage("task", messages[0].id).messages.length, 1);
    assert.throws(() => f.chats.deleteMessage("task", messages[0].id), /not found/);
    assert.equal(f.chats.deleteMessage("task", messages[1].id).messages.length, 0);
    const reloaded = new ChatStore(f.tasks);
    try { assert.deepEqual(reloaded.forTask("task").messages, []); } finally { reloaded.close(); }
    assert.deepEqual(f.tasks.list(), before);
  } finally { f.cleanup(); }
});

test("delete and clear respect task scope, workspace scope, and active responses", () => {
  const f = fixture();
  try {
    const turn = f.chats.begin("task", "Question");
    const messageId = turn.session.messages[0].id;
    assert.throws(() => f.chats.deleteMessage("task", messageId), /Wait for the chat response/);
    assert.throws(() => f.chats.clear("task"), /Wait for the chat response/);
    f.chats.finish(turn.session.id, turn.lease, "Failed response");
    f.tasks.save({ id: "another", title: "Another task", description: "", status: "To do" });
    f.chats.forTask("another");
    assert.throws(() => f.chats.deleteMessage("another", messageId), /not found/);
    f.chats.clear("another");
    assert.equal(f.chats.forTask("task").messages.length, 1);
    const other = f.tasks.createWorkspace("Other", f.directory);
    const tasks = new TaskStore(f.path, other.id);
    const chats = new ChatStore(tasks);
    try {
      assert.throws(() => chats.deleteMessage("task", messageId), /no longer exists/);
      assert.throws(() => chats.clear("task"), /no longer exists/);
    } finally { chats.close(); tasks.close(); }
    const cleared = f.chats.clear("task");
    assert.deepEqual(cleared.messages, []);
    assert.equal(cleared.error, null);
    assert.equal(cleared.running, false);
    assert.equal(cleared.id, turn.session.id);
    assert.equal(f.tasks.list().find((task) => task.id === "task")!.comments?.length, 1);
  } finally { f.cleanup(); }
});
