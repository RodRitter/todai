import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore } from "./task-store.ts";
import { ChatStore } from "./chat-store.ts";
import { parseUserName } from "../domain/user-name.ts";
import { isHumanComment } from "../domain/comment-author.ts";
import { commentChatDraft } from "../domain/comment-reference.ts";
import { agentPrompt } from "./agent-prompt.ts";

test("names are validated and trimmed", () => {
  assert.equal(parseUserName("  Renée 王  "), "Renée 王");
  for (const value of [undefined, null, 7, " ", "a".repeat(101), "Name\nInstruction"]) assert.throws(() => parseUserName(value));
});

test("setup saves a global name and new messages preserve their author after a rename", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-name-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path, undefined, { seedWorkspace: false });
  try {
    const workspace = store.createWorkspace("First", directory, { userName: " Roderick " });
    const second = store.createWorkspace("Second", directory);
    const tasks = new TaskStore(path, workspace.id);
    const other = new TaskStore(path, second.id);
    const chats = new ChatStore(tasks);
    try {
      assert.equal(other.getUserName(), "Roderick");
      tasks.save({ id: "task", title: "Task", description: "", status: "To do" });
      const comment = tasks.postComment("task", "A note").comments![0];
      assert.equal(comment.authorName, "Roderick");
      assert.ok(isHumanComment(comment));
      assert.equal(commentChatDraft(comment, [{ id: "agent", name: "Roderick" }]), `[Comment by Roderick](#comment/task/${comment.id}) `);
      const chat = chats.begin("task", "A chat message");
      assert.equal(chat.session.messages[0].authorName, "Roderick");
      assert.ok(isHumanComment(chat.session.messages[0]));
      other.setUserName("Alex");
      assert.equal(tasks.getUserName(), "Alex");
      assert.equal(tasks.list()[0].comments![0].authorName, "Roderick");
      assert.equal(tasks.postComment("task", "Another note").comments!.at(-1)!.authorName, "Alex");
      assert.equal(isHumanComment({ ...comment, authorName: "Human", authorRole: "agent" }), false);
    } finally { chats.close(); other.close(); tasks.close(); }
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("agents receive the user name in task, reply, intent, and chat prompts", () => {
  const store = new TaskStore(":memory:");
  try {
    store.saveAgent({ id: "agent", name: "Builder", tool: "codex", model: "test", effort: "medium", permissions: "workspace-write", instructions: "Build" });
    store.assignColumnAgent({ column: "In progress", agentId: "agent" });
    const task = store.save({ id: "task", title: "Task", description: "", status: "In progress", autoRun: true });
    const run = store.history(task.id)[0];
    const request = { run, task, userName: "Roderick", workspace: "/tmp", signal: new AbortController().signal, onStart() {} };
    for (const kind of [undefined, "reply", "intent"] as const) assert.match(agentPrompt({ ...request, run: { ...run, kind } }), /human user's name is "Roderick"/);
    assert.match(agentPrompt({ ...request, privateChat: { messages: [] } }), /human user's name is "Roderick"/);
  } finally { store.close(); }
});
