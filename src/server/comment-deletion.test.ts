import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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
    assert.throws(() => store.deleteComment("one", "feedback"), /Answer or cancel/);
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
