import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";
import { DELETE } from "../app/api/tasks/comments/route.ts";

test("comment deletion validates ownership and removes attachments without deleting artifacts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-delete-comment-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const store = new TaskStore(process.env.TODAI_DB_PATH);
  const library = new ArtifactStore(process.env.TODAI_DB_PATH, store.workspaceId);
  const remove = (body: unknown, workspace: string | null = store.workspaceId) => DELETE(new Request("http://localhost/api/tasks/comments", {
    method: "DELETE", body: JSON.stringify(body), headers: workspace ? { "X-Todai-Workspace": workspace } : {},
  }));
  try {
    for (const id of ["one", "two"]) store.save({ id, title: id, description: "", status: "To do" });
    const artifact = library.create({ title: "Evidence", type: "text", creator: "Human", content: "Keep this" });
    const comment = store.postComment("one", "Remove me", [{ artifactId: artifact.id, revisionId: artifact.revisionId }]).comments![0];
    store.postComment("one", "Keep me");
    const data = { taskId: "one", commentId: comment.id };
    assert.equal((await remove(data, null)).status, 403);
    const other = store.createWorkspace("Other", directory);
    assert.equal((await remove(data, other.id)).status, 403);
    assert.equal((await remove({ ...data, taskId: "two" })).status, 400);
    for (const invalid of [null, {}, { taskId: "one", commentId: 1 }]) assert.equal((await remove(invalid)).status, 400);
    const response = await remove(data);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).comments.map((item: { body: string }) => item.body), ["Keep me"]);
    assert.equal(library.forTask("one").length, 0);
    assert.equal(library.read(artifact.id).id, artifact.id);
    assert.equal((await remove(data)).status, 400);
    store.addComment({ id: "feedback", taskId: "one", body: "Question", createdAt: new Date().toISOString(), feedbackStatus: "pending" });
    assert.ok(!store.deleteComment("one", "feedback").comments!.some((item) => item.id === "feedback"));
    store.saveAgent({ id: "agent", name: "Agent", tool: "codex", model: "test", effort: "medium", permissions: "workspace-write", instructions: "" });
    store.assignColumnAgent({ column: "In progress", agentId: "agent" });
    store.save({ id: "two", title: "two", description: "", status: "In progress", autoRun: true });
    store.addComment({ id: "active", taskId: "two", body: "Context", createdAt: new Date().toISOString() });
    assert.throws(() => store.deleteComment("two", "active"), /Stop the agent/);
  } finally {
    library.close(); store.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deleting a feedback message removes its nested replies only", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-delete-thread-"));
  const store = new TaskStore(join(directory, "tasks.sqlite"));
  try {
    for (const id of ["one", "two"]) store.save({ id, title: id, description: "", status: "To do" });
    const db = new DatabaseSync(join(directory, "tasks.sqlite"));
    try {
      const insert = db.prepare("INSERT INTO runs (workspaceId, id, taskId, column, profile, status, createdAt) VALUES (?, ?, ?, 'To do', '{}', 'Complete', '2026-11-19T10:00:00Z')");
      insert.run(store.workspaceId, "run", "one");
      insert.run(store.workspaceId, "another-run", "one");
    } finally { db.close(); }
    const base = { taskId: "one", body: "Message", createdAt: "2026-11-19T10:00:00Z", runId: "run" };
    store.addComment({ ...base, id: "question", authorName: "Agent", feedbackStatus: "answered" });
    for (const id of ["reply-one", "reply-two", "reply-three"]) store.addComment({ ...base, id, authorName: "Human" });
    store.addComment({ ...base, id: "agent-output", authorName: "Agent" });
    store.addComment({ ...base, id: "ordinary", authorName: "Human", runId: undefined });
    store.addComment({ ...base, id: "other-cycle", authorName: "Human", runId: "another-run" });
    store.addComment({ ...base, taskId: "two", id: "other-task", authorName: "Human", runId: undefined });

    const afterReply = store.deleteComment("one", "reply-one").comments!;
    assert.ok(afterReply.some((comment) => comment.id === "question"));
    assert.ok(afterReply.some((comment) => comment.id === "reply-two"));
    assert.ok(!afterReply.some((comment) => comment.id === "reply-one"));

    const afterParent = store.deleteComment("one", "question").comments!;
    assert.deepEqual(afterParent.map((comment) => comment.id).sort(), ["agent-output", "ordinary", "other-cycle"]);
    assert.deepEqual(store.list().find((task) => task.id === "two")!.comments!.map((comment) => comment.id), ["other-task"]);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
