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

test("task links reuse artifacts, follow document edits and survive task deletion", () => {
  const f = fixture();
  try {
    f.task("one"); f.task("two");
    const first = f.artifacts.create({ title: "Evidence", type: "text", content: "Original", creator: "Alice" });
    f.artifacts.linkTask("one", first.id);
    f.artifacts.linkTask("one", first.id);
    f.artifacts.linkTask("two", first.id);
    const latest = f.artifacts.update(first.id, { title: "Updated", type: "text", content: "Updated", creator: "Bob" });
    assert.deepEqual(f.artifacts.forTask("one"), [{ artifact: latest, explicit: true, comments: [] }]);
    assert.deepEqual(f.artifacts.list({ taskId: "two" }), [latest]);
    f.artifacts.unlinkTask("one", first.id);
    assert.deepEqual(f.artifacts.forTask("one"), []);
    f.tasks.delete("two");
    assert.equal(f.artifacts.download(first.id).bytes.toString(), "Updated");
    assert.deepEqual(f.artifacts.read(first.id), latest);
  } finally { f.close(); }
});

test("comment attachments attach documents atomically and retain provenance after unlinking and archival", () => {
  const f = fixture();
  try {
    f.task("one"); f.task("two");
    const first = f.artifacts.create({ title: "Original", type: "text", content: "Original", creator: "Alice" });
    const ref = { artifactId: first.id };
    const comment = f.tasks.postComment("one", `See [evidence](#artifact/${first.id})`, [ref, ref]).comments![0];
    f.tasks.postComment("two", `Reuse [evidence](#artifact/${first.id})`, [ref]);
    f.artifacts.linkTask("one", first.id);
    const latest = f.artifacts.update(first.id, { title: "Latest", type: "text", content: "Latest", creator: "Bob" });
    assert.deepEqual(f.artifacts.forTask("one"), [{ artifact: latest, explicit: true, comments: [{ commentId: comment.id, artifact: latest }] }]);
    assert.deepEqual(comment.artifacts, [ref]);
    f.artifacts.unlinkTask("one", first.id);
    assert.equal(f.artifacts.forTask("one")[0].explicit, false);
    assert.deepEqual(f.artifacts.list({ taskId: "one" }), [latest]);
    f.artifacts.archive(first.id);
    assert.equal(f.artifacts.forTask("one")[0].comments[0].artifact.id, first.id);
    f.tasks.delete("one");
    assert.equal(f.artifacts.forTask("two").length, 1);
    assert.equal(f.artifacts.download(first.id).bytes.toString(), "Latest");
  } finally { f.close(); }
});

test("foreign tasks and artifacts are rejected and failed comment publication leaves no partial comment", () => {
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
    for (const invalid of [null, {}, [{ artifactId: foreign.id }], [{ artifactId: "missing" }]]) {
      assert.throws(() => f.tasks.postComment("one", "Invalid", invalid), /attachment|Artifact/);
      assert.deepEqual(f.tasks.list()[0].comments, []);
      assert.deepEqual(f.artifacts.forTask("one"), []);
    }
    assert.throws(() => f.tasks.postComment("foreign", "Invalid", [{ artifactId: local.id }]), /workspace/);
  } finally { otherArtifacts.close(); otherTasks.close(); f.close(); }
});

test("inline citations follow document edits through composition, repetition and archival", () => {
  const f = fixture();
  try {
    f.task("one");
    const first = f.artifacts.create({ title: "Original", type: "text", content: "Original", creator: "Alice" });
    const body = `See [Original](#artifact/${first.id}) and [again](#artifact/${first.id}).`;
    f.artifacts.update(first.id, { title: "Latest", type: "text", content: "Latest", creator: "Bob" });
    const comment = f.tasks.postComment("one", body).comments![0];
    assert.deepEqual(comment.artifacts, [{ artifactId: first.id }]);
    f.artifacts.archive(first.id);
    assert.equal(f.tasks.list()[0].comments![0].body, body);
    assert.equal(f.artifacts.forTask("one")[0].comments[0].artifact.title, "Latest");
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
    for (const path of [`#artifact/${foreign.id}`, "#artifact/missing", "#artifact/broken"]) {
      assert.throws(() => f.tasks.postComment("one", `[Invalid](${path})`, [{ artifactId: local.id }]), /reference|not found/);
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
    f.tasks.addComment({ id: "agent-comment", taskId: "one", authorName: "Agent", createdAt: new Date().toISOString(), body: `[Evidence](#artifact/${artifact.id}) and \`[example](#artifact/invalid)\`` });
    assert.deepEqual(f.tasks.list()[0].comments![0].artifacts, [{ artifactId: artifact.id }]);
  } finally { f.close(); }
});

test("new and edited task descriptions attach cited artifacts on save", () => {
  const f = fixture();
  try {
    const first = f.artifacts.create({ title: "Brief", type: "markdown", content: "Brief", creator: "You" });
    const second = f.artifacts.create({ title: "Plan", type: "markdown", content: "Plan", creator: "You" });
    const description = `[Brief](#artifact/${first.id}) [@Agent](#agent/agent) [skill](/skills/test) [file](/src/test)`;
    const task = f.tasks.save({ id: "draft", title: "Draft", description, status: "To do", agentStatus: "Not started" });
    assert.equal(task.description, description);
    assert.deepEqual(f.artifacts.forTask(task.id).map((link) => link.artifact.id), [first.id]);
    f.tasks.save({ ...task, description: `${description} [Plan](#artifact/${second.id})` });
    assert.deepEqual(f.artifacts.forTask(task.id).map((link) => link.artifact.id).sort(), [first.id, second.id].sort());
    assert.throws(() => f.tasks.save({ ...task, title: "Invalid", description: "[Missing](#artifact/missing/revision)" }), /reference|not found/);
    assert.equal(f.tasks.list()[0].title, "Draft");
  } finally { f.close(); }
});

test("comments and replies attach only artifacts tagged in their text", () => {
  const f = fixture();
  try {
    f.task("one");
    const tagged = f.artifacts.create({ title: "Tagged", type: "text", content: "Keep", creator: "Human" });
    const removed = f.artifacts.create({ title: "Removed", type: "text", content: "Keep in library", creator: "Human" });
    const attachments = [tagged, removed].map((artifact) => ({ artifactId: artifact.id }));
    const parent = f.tasks.postComment("one", "The tag was removed.", attachments).comments![0];
    assert.equal(parent.artifacts, undefined);
    const body = `[Tagged](#artifact/${tagged.id}) and \`[Example](#artifact/${removed.id})\``;
    const reply = f.tasks.postComment("one", body, attachments, parent.id).comments!.find((comment) => comment.parentCommentId === parent.id)!;
    assert.deepEqual(reply.artifacts, [{ artifactId: tagged.id }]);
    assert.deepEqual(f.artifacts.forTask("one").map((link) => link.artifact.id), [tagged.id]);
    assert.equal(f.artifacts.read(removed.id).id, removed.id);
  } finally { f.close(); }
});
