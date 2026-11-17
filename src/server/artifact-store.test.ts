import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
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

test("revisions preserve exact published content and provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const store = new ArtifactStore(path, tasks.workspaceId);
  tasks.close();
  try {
    const first = store.create({ title: "Original", type: "markdown", creator: "Alice", content: "# Original" });
    const second = store.revise(first.id, { title: "Revised", type: "markdown", creator: "Bob", content: "# Revised" });
    assert.equal(second.id, first.id);
    assert.notEqual(second.revisionId, first.revisionId);
    assert.equal(second.revisionNumber, 2);
    assert.equal(second.creator, "Bob");
    assert.ok(second.updatedAt);
    assert.deepEqual(store.read(first.id, first.revisionId), first);
    assert.equal(store.download(first.id, first.revisionId).bytes.toString(), "# Original");
    assert.equal(store.download(first.id).bytes.toString(), "# Revised");
    assert.deepEqual(store.history(first.id), [second, first]);
    assert.throws(() => store.revise(first.id, { title: "Invalid", type: "link", creator: "Bob", url: "file:///private" }), /HTTP/);
    assert.deepEqual(store.history(first.id), [second, first]);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("archival hides discovery but retains file revisions and workspace isolation", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const other = tasks.createWorkspace("Other", directory);
  const store = new ArtifactStore(path, tasks.workspaceId);
  const isolated = new ArtifactStore(path, other.id);
  try {
    const first = store.create({ title: "Evidence", type: "file", creator: "Alice", filename: "one.bin", bytes: new Uint8Array([0, 255]) });
    const second = store.revise(first.id, { title: "New evidence", type: "file", creator: "Bob", filename: "two.bin", bytes: new Uint8Array([42]) });
    assert.throws(() => isolated.archive(first.id), /not found/);
    assert.throws(() => isolated.revise(first.id, { title: "Wrong", type: "text", creator: "Other", content: "" }), /not found/);
    assert.throws(() => isolated.history(first.id), /not found/);
    store.archive(first.id);
    assert.deepEqual(store.list(), []);
    assert.equal(store.list({ archived: true })[0].id, first.id);
    assert.equal(store.read(first.id).archived, true);
    assert.equal(store.history(first.id).length, 2);
    assert.deepEqual(store.download(first.id, first.revisionId).bytes, Buffer.from([0, 255]));
    assert.deepEqual(store.download(first.id, second.revisionId).bytes, Buffer.from([42]));
  } finally { tasks.close(); store.close(); isolated.close(); rmSync(directory, { recursive: true, force: true }); }
});


test("concurrent publishers retain every successful link revision across restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const workspaceId = tasks.workspaceId;
  tasks.close();
  let store = new ArtifactStore(path, workspaceId);
  try {
    const first = store.create({ title: "Reference", type: "link", creator: "Original", url: "https://example.com/original" });
    const script = `
      const { ArtifactStore } = await import(process.argv[1]);
      const store = new ArtifactStore(process.argv[2], process.argv[3]);
      const result = store.revise(process.argv[4], {
        title: "Reference " + process.argv[5], type: "link", creator: process.argv[5],
        url: "https://example.com/" + process.argv[5]
      });
      console.log(JSON.stringify(result));
      store.close();`;
    const publications = await Promise.all(["Alice", "Bob", "Carol", "Dan"].map(async (author) => {
      const { stdout } = await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script,
        new URL("./artifact-store.ts", import.meta.url).href, path, workspaceId, first.id, author]);
      return JSON.parse(stdout);
    }));
    store.close();
    store = new ArtifactStore(path, workspaceId);
    assert.deepEqual(store.history(first.id).map((revision) => revision.revisionNumber), [5, 4, 3, 2, 1]);
    assert.equal(new Set(store.history(first.id).map((revision) => revision.revisionId)).size, 5);
    for (const revision of publications) {
      assert.deepEqual(store.read(first.id, revision.revisionId), revision);
      assert.equal(revision.url, `https://example.com/${revision.creator}`);
    }
    assert.deepEqual(store.read(first.id, first.revisionId), first);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("existing artifact storage migrates into a retained first revision", () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-artifacts-"));
  const path = join(directory, "tasks.sqlite");
  const tasks = new TaskStore(path);
  const workspaceId = tasks.workspaceId;
  tasks.close();
  // Fixture represents the schema shipped before revision support.
  const legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE artifacts (
    id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
    type TEXT NOT NULL, creator TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
    filename TEXT, mediaType TEXT, byteSize INTEGER, url TEXT, content BLOB
  )`);
  legacy.prepare("INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("legacy", workspaceId, "Old document", "Evidence", "text", "Alice", "2026-01-01", "2026-01-01", "artifact.txt", "text/plain", 3, null, Buffer.from("Old"));
  legacy.close();
  const store = new ArtifactStore(path, workspaceId);
  try {
    const first = store.read("legacy");
    assert.equal(first.revisionNumber, 1);
    assert.equal(first.createdAt, "2026-01-01");
    store.revise("legacy", { title: "Updated", type: "text", creator: "Bob", content: "New" });
    assert.equal(store.download("legacy", first.revisionId).bytes.toString(), "Old");
    assert.equal(store.history("legacy").length, 2);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
