import { test } from "node:test";
import assert from "node:assert/strict";
import { groupActivity } from "../domain/activity.ts";
import type { TaskComment } from "../domain/task.ts";

const question: TaskComment = { id: "question", taskId: "task", authorName: "Builder", body: "Proceed?", runId: "run", feedbackStatus: "answered", createdAt: "2026-11-19T10:00:00Z" };
const answer: TaskComment = { id: "answer", taskId: "task", authorName: "Human", body: "Yes", runId: "run", createdAt: "2026-11-19T10:02:00Z" };
test("feedback answers nest with their question without duplicating ordinary messages", () => {
  const message = { ...answer, id: "message", runId: undefined, createdAt: "2026-11-19T10:01:00Z" };
  const result = groupActivity([answer, question, message]);
  assert.deepEqual(result, [{ message, replies: [] }, { message: question, replies: [answer] }]);
});
test("answers remain visible when their question was deleted; absent run IDs never match", () => {
  assert.deepEqual(groupActivity([answer]), [{ message: answer, replies: [] }]);
  const unlinkedQuestion = { ...question, runId: undefined };
  const unlinkedAnswer = { ...answer, runId: undefined };
  assert.equal(groupActivity([unlinkedQuestion, unlinkedAnswer]).length, 2);
});
test("multiple feedback cycles keep answers attached to the correct run", () => {
  const next = { ...question, id: "next", runId: "next-run", feedbackStatus: "pending" as const, createdAt: "2026-11-19T10:03:00Z" };
  assert.deepEqual(groupActivity([question, answer, next]), [{ message: next, replies: [] }, { message: question, replies: [answer] }]);
});


test("explicit replies stay beneath their parent in chronological order, and orphan replies stay visible", () => {
  const parent = { ...question, feedbackStatus: undefined, runId: undefined };
  const first = { ...answer, runId: undefined, parentCommentId: parent.id };
  const second = { ...first, id: "second", createdAt: "2026-11-19T10:03:00Z" };
  assert.deepEqual(groupActivity([second, parent, first]), [{ message: parent, replies: [first, second] }]);
  assert.deepEqual(groupActivity([first]), [{ message: first, replies: [] }]);
});
