import assert from "node:assert/strict";
import test from "node:test";
import { codexActivity, createClaudeActivity } from "./run-activity.ts";
import type { RunActivityUpdate } from "../domain/execution.ts";

test("Codex activity preserves tool IDs and reports command exit failures", () => {
  const item = { id: "cmd", type: "command_execution", command: "npm test", status: "in_progress" };
  assert.equal(codexActivity({ type: "item.started", item })?.status, "running");
  const result = codexActivity({ type: "item.completed", item: { ...item, status: "completed", exit_code: 1, aggregated_output: "test failed\n  line 2" } });
  assert.deepEqual(result, { id: "cmd", title: "npm test", status: "error", detail: "test failed\n  line 2" });
  assert.equal(codexActivity({ type: "item.completed", item: { id: "thought", type: "reasoning", text: "private" } }), undefined);
  assert.equal(codexActivity({ type: "item.completed", item: { id: "answer", type: "agent_message", text: "answer" } }), undefined);
  for (const value of [null, {}, { type: "item.completed", item: null }]) assert.equal(codexActivity(value), undefined);
});

test("Codex activity bounds output and includes only supported tool result text", () => {
  const result = codexActivity({ type: "item.completed", item: { id: "tool", type: "mcp_tool_call", server: "files", tool: "read", arguments: { secret: "hidden" }, result: { content: [{ type: "image", data: "hidden" }, { type: "text", text: "x".repeat(20000) }] } } });
  assert.equal(result!.toolName, "read");
  assert.ok(result!.detail!.length <= 16000);
  assert.match(result!.detail!, /Output truncated/);
  assert.doesNotMatch(JSON.stringify(result), /hidden/);
});

test("Claude activity pairs parallel calls with results and ignores thinking and malformed events", () => {
  const updates: RunActivityUpdate[] = [];
  const accept = createClaudeActivity(update => updates.push(update));
  for (const value of [null, {}, { type: "assistant", message: { content: "invalid" } }]) accept(value);
  accept({ type: "assistant", message: { content: [
    { type: "thinking", thinking: "private" },
    { type: "tool_use", id: "a", name: "Bash", input: { command: "npm test" } },
    { type: "tool_use", id: "b", name: "Read", input: { file_path: "src/app.ts" } },
  ] } });
  accept({ type: "user", message: { content: [
    { type: "tool_result", tool_use_id: "missing", content: "ignore" },
    { type: "tool_result", tool_use_id: "b", content: [{ type: "text", text: "contents" }] },
    { type: "tool_result", tool_use_id: "a", is_error: true, content: "test failed" },
  ] } });
  assert.deepEqual(updates.map(update => [update.id, update.status]), [["a", "running"], ["b", "running"], ["b", "complete"], ["a", "error"]]);
  assert.equal(updates[3].title, "Bash: npm test");
  assert.equal(updates[2].detail, "contents");
  assert.equal(updates[2].toolName, "Read");
  assert.equal(updates[2].filePath, "src/app.ts");
  assert.doesNotMatch(JSON.stringify(updates), /private|ignore/);
});
