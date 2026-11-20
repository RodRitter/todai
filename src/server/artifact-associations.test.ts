import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todai-associations-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const artifacts = new ArtifactStore(path, tasks.workspaceId);
  const task = (id: string) => tasks.save({ id, title: id, description: "", status: "To do", agentStatus: "Not started" });
  return { directory, path, tasks, artifacts, task, close() { artifacts.close(); tasks.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("task links reuse artifacts, follow latest revisions and survive task deletion", () => {
  const f = fixture();
  try {
    f.task("one"); f.task("two");
    const first = f.artifacts.create({ title: "Evidence", type: "text", content: "Original", creator: "Alice" });
    f.artifacts.linkTask("one", first.id);
    f.artifacts.linkTask("one", first.id);
    f.artifacts.linkTask("two", first.id);
    const latest = f.artifacts.revise(first.id, { title: "Updated", type: "text", content: "Updated", creator: "Bob" });
    assert.deepEqual(f.artifacts.forTask("one"), [{ artifact: latest, explicit: true, comments: [] }]);
    assert.deepEqual(f.artifacts.list({ taskId: "two" }), [latest]);
    f.artifacts.unlinkTask("one", first.id);
    assert.deepEqual(f.artifacts.forTask("one"), []);
    f.tasks.delete("two");
    assert.equal(f.artifacts.download(first.id, first.revisionId).bytes.toString(), "Original");
    assert.deepEqual(f.artifacts.history(first.id), [latest, first]);
  } finally { f.close(); }
});

test("comment attachments pin revisions atomically and retain provenance after unlinking and archival", () => {
  const f = fixture();
  try {
    f.task("one"); f.task("two");
    const first = f.artifacts.create({ title: "Original", type: "text", content: "Original", creator: "Alice" });
    const ref = { artifactId: first.id, revisionId: first.revisionId };
    const comment = f.tasks.postComment("one", "See evidence", [ref, ref]).comments![0];
    f.tasks.postComment("two", "Reuse evidence", [ref]);
    f.artifacts.linkTask("one", first.id);
    const latest = f.artifacts.revise(first.id, { title: "Latest", type: "text", content: "Latest", creator: "Bob" });
    assert.deepEqual(f.artifacts.forTask("one"), [{ artifact: latest, explicit: true, comments: [{ commentId: comment.id, artifact: first }] }]);
    assert.deepEqual(comment.artifacts, [ref]);
    f.artifacts.unlinkTask("one", first.id);
    assert.equal(f.artifacts.forTask("one")[0].explicit, false);
    assert.deepEqual(f.artifacts.list({ taskId: "one" }), [latest]);
    f.artifacts.archive(first.id);
    assert.equal(f.artifacts.forTask("one")[0].comments[0].artifact.revisionId, first.revisionId);
    f.tasks.delete("one");
    assert.equal(f.artifacts.forTask("two").length, 1);
    assert.equal(f.artifacts.download(first.id, first.revisionId).bytes.toString(), "Original");
  } finally { f.close(); }
});

test("foreign tasks and revisions are rejected and failed comment publication leaves no partial comment", () => {
  const f = fixture();
  const other = f.tasks.createWorkspace("Other", f.directory);
  const otherTasks = new TaskStore(f.path, other.id);
  const otherArtifacts = new ArtifactStore(f.path, other.id);
  try {
    f.task("one");
    otherTasks.save({ id: "foreign", title: "Foreign", description: "", status: "To do", agentStatus: "Not started" });
    const local = f.artifacts.create({ title: "Local", type: "text", creator: "Alice", content: "Local" });
    const foreign = otherArtifacts.create({ title: "Foreign", type: "text", creator: "Bob", content: "Foreign" });
    assert.throws(() => f.artifacts.linkTask("foreign", local.id), /workspace/);
    assert.throws(() => f.artifacts.linkTask("one", foreign.id), /workspace/);
    assert.throws(() => f.artifacts.forTask("foreign"), /workspace/);
    assert.throws(() => f.artifacts.list({ taskId: "foreign" }), /workspace/);
    for (const invalid of [null, {}, [{ artifactId: foreign.id, revisionId: foreign.revisionId }], [{ artifactId: local.id, revisionId: foreign.revisionId }]]) {
      assert.throws(() => f.tasks.postComment("one", "Invalid", invalid), /attachment|revision/);
      assert.deepEqual(f.tasks.list()[0].comments, []);
      assert.deepEqual(f.artifacts.forTask("one"), []);
    }
    assert.throws(() => f.tasks.postComment("foreign", "Invalid", [{ artifactId: local.id, revisionId: local.revisionId }]), /workspace/);
  } finally { otherArtifacts.close(); otherTasks.close(); f.close(); }
});

test("inline citations retain the selected revision through composition, repetition and archival", () => {
  const f = fixture();
  try {
    f.task("one");
    const first = f.artifacts.create({ title: "Original", type: "text", content: "Original", creator: "Alice" });
    const body = `See [Original](#artifact/${first.id}/${first.revisionId}) and [again](#artifact/${first.id}/${first.revisionId}).`;
    f.artifacts.revise(first.id, { title: "Latest", type: "text", content: "Latest", creator: "Bob" });
    const comment = f.tasks.postComment("one", body).comments![0];
    assert.deepEqual(comment.artifacts, [{ artifactId: first.id, revisionId: first.revisionId }]);
    f.artifacts.archive(first.id);
    assert.equal(f.tasks.list()[0].comments![0].body, body);
    assert.equal(f.artifacts.forTask("one")[0].comments[0].artifact.title, "Original");
  } finally { f.close(); }
});

test("invalid inline citations roll back comments and attachments together", () => {
  const f = fixture();
  const other = f.tasks.createWorkspace("Other", f.directory);
  const foreignStore = new ArtifactStore(f.path, other.id);
  try {
    f.task("one");
    const local = f.artifacts.create({ title: "Local", type: "text", content: "Local", creator: "Alice" });
    const foreign = foreignStore.create({ title: "Foreign", type: "text", content: "Foreign", creator: "Bob" });
    for (const path of [`#artifact/${foreign.id}/${foreign.revisionId}`, `#artifact/${local.id}/${foreign.revisionId}`, "#artifact/broken"]) {
      assert.throws(() => f.tasks.postComment("one", `[Invalid](${path})`, [{ artifactId: local.id, revisionId: local.revisionId }]), /revision/);
      assert.deepEqual(f.tasks.list()[0].comments, []);
      assert.deepEqual(f.artifacts.forTask("one"), []);
    }
  } finally { foreignStore.close(); f.close(); }
});

test("agent comments track canonical citations while code examples remain plain context", () => {
  const f = fixture();
  try {
    f.task("one");
    const artifact = f.artifacts.create({ title: "Evidence", type: "text", content: "Evidence", creator: "Agent" });
    f.tasks.addComment({ id: "agent-comment", taskId: "one", authorName: "Agent", createdAt: new Date().toISOString(), body: `[Evidence](#artifact/${artifact.id}/${artifact.revisionId}) and \`[example](#artifact/invalid)\`` });
    assert.deepEqual(f.tasks.list()[0].comments![0].artifacts, [{ artifactId: artifact.id, revisionId: artifact.revisionId }]);
  } finally { f.close(); }
});

test("new and edited task descriptions attach cited artifacts on save", () => {
  const f = fixture();
  try {
    const first = f.artifacts.create({ title: "Brief", type: "markdown", content: "Brief", creator: "You" });
    const second = f.artifacts.create({ title: "Plan", type: "markdown", content: "Plan", creator: "You" });
    const description = `[Brief](#artifact/${first.id}/${first.revisionId}) [@Agent](#agent/agent) [skill](/skills/test) [file](/src/test)`;
    const task = f.tasks.save({ id: "draft", title: "Draft", description, status: "To do", agentStatus: "Not started" });
    assert.equal(task.description, description);
    assert.deepEqual(f.artifacts.forTask(task.id).map((link) => link.artifact.id), [first.id]);
    f.tasks.save({ ...task, description: `${description} [Plan](#artifact/${second.id}/${second.revisionId})` });
    assert.deepEqual(f.artifacts.forTask(task.id).map((link) => link.artifact.id).sort(), [first.id, second.id].sort());
    assert.throws(() => f.tasks.save({ ...task, title: "Invalid", description: "[Missing](#artifact/missing/revision)" }), /revision/);
    assert.equal(f.tasks.list()[0].title, "Draft");
  } finally { f.close(); }
});
