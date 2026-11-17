import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";

test("published Markdown retains metadata and content across restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const workspaceId = tasks.workspaceId;
  tasks.close();
  let store = new ArtifactStore(path, workspaceId);
  try {
    const artifact = store.create({ title: "Design", type: "markdown", creator: "Rod", description: "Decisions", content: "# Plan\nKeep it simple." });
    store.close();
    store = new ArtifactStore(path, workspaceId);
    assert.deepEqual(store.read(artifact.id), artifact);
    assert.equal(artifact.workspaceId, workspaceId);
    assert.equal(artifact.creator, "Rod");
    assert.ok(artifact.createdAt);
    assert.equal(artifact.updatedAt, artifact.createdAt);
    assert.equal(store.download(artifact.id).bytes.toString(), "# Plan\nKeep it simple.");
    assert.deepEqual(store.list({ search: "decisions", type: "markdown", creator: "Rod" }), [artifact]);
    assert.deepEqual(store.list({ creator: "Someone else" }), []);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("file publication copies arbitrary bytes and isolates workspace discovery and downloads", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const other = tasks.createWorkspace("Other", directory);
  const store = new ArtifactStore(path, tasks.workspaceId);
  const isolated = new ArtifactStore(path, other.id);
  try {
    const sourcePath = join(directory, "source.custom");
    writeFileSync(sourcePath, Buffer.from([0, 255, 4, 9]));
    const source = readFileSync(sourcePath);
    const file = store.create({ title: "Unknown format", type: "file", creator: "Rod", filename: "sample.custom", mediaType: "application/x-custom", bytes: source });
    source.fill(1);
    writeFileSync(sourcePath, "Changed");
    rmSync(sourcePath);
    assert.deepEqual(store.download(file.id).bytes, Buffer.from([0, 255, 4, 9]));
    assert.equal(file.filename, "sample.custom");
    assert.equal(file.mediaType, "application/x-custom");
    assert.equal(file.byteSize, 4);
    assert.deepEqual(isolated.list({ search: "Unknown" }), []);
    assert.throws(() => isolated.read(file.id), /not found/);
    assert.throws(() => isolated.download(file.id), /not found/);
    assert.throws(() => store.download("../../tasks.sqlite"), /not found/);
    tasks.setWorkspaceArchived(other.id, true);
    assert.throws(() => isolated.create({ title: "Hidden", type: "text", creator: "Rod", content: "" }), /unavailable/);
  } finally { tasks.close(); store.close(); isolated.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("external links retain descriptive metadata and failed publications leave no records", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const store = new ArtifactStore(path, tasks.workspaceId);
  tasks.close();
  try {
    const link = store.create({ title: "Reference", type: "link", creator: "Rod", description: "Remote specification", url: "https://example.com/spec" });
    assert.equal(store.read(link.id).url, "https://example.com/spec");
    assert.equal(link.byteSize, null);
    assert.throws(() => store.download(link.id), /no stored content/);
    assert.throws(() => store.create({ title: "Bad URL", type: "link", creator: "Rod", url: "javascript:alert(1)" }), /HTTP/);
    assert.throws(() => store.create({ title: "Too big", type: "file", creator: "Rod", filename: "large.bin", bytes: new Uint8Array(20 * 1024 * 1024 + 1) }), /20 MiB/);
    assert.throws(() => store.create({ title: "", type: "text", creator: "Rod", content: "Bad" }), /Title/);
    assert.deepEqual(store.list(), [link]);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
