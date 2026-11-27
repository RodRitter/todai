import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";
import { parseConfiguration, selectConfiguration } from "../domain/configuration.ts";

test("memory export includes evidence and imports archived copies with working links", () => {
  const directory = mkdtempSync(join(tmpdir(), "memory-transfer-"));
  const path = join(directory, "source.sqlite");
  const source = new TaskStore(path);
  const target = new TaskStore(join(directory, "target.sqlite"));
  const artifacts = new ArtifactStore(path, source.workspaceId);
  const db = new DatabaseSync(path);
  try {
    source.save({ id: "source-task", title: "Source task", description: "Evidence", status: "Done" });
    source.save({ id: "unrelated", title: "Unrelated task", description: "", status: "To do" });
    const file = artifacts.create({ title: "Evidence file", type: "file", creator: "User", bytes: new Uint8Array([0, 1, 128, 255]), filename: "evidence.bin" });
    const direct = artifacts.create({ title: "Direct evidence", type: "markdown", creator: "User", content: "[Source](#task/source-task)" });
    artifacts.create({ title: "Unrelated file", type: "text", creator: "User", content: "Do not export" });
    artifacts.linkTask("source-task", file.id);
    db.prepare("INSERT INTO comments (id, workspaceId, taskId, body, createdAt, authorName, authorRole) VALUES ('comment', ?, 'source-task', ?, '2026-01-01', 'User', 'human')")
      .run(source.workspaceId, `[Evidence](#artifact/${file.id})`);
    db.prepare("INSERT INTO comment_artifacts VALUES ('comment', ?)").run(file.id);
    source.changeMemory({ operation: "add", category: "Decisions", title: "Decision", statement: "Keep this decision.", scope: "Workspace", source: `[Source](#task/source-task) [Document](#artifact/${direct.id})`, reason: "Test" });
    source.changeMemory({ operation: "add", category: "Terms", title: "Independent", statement: "Independent memory.", scope: "Workspace", source: "User", reason: "Test" });
    const exported = parseConfiguration(JSON.parse(JSON.stringify(source.exportConfiguration())));
    assert.equal(exported.memory?.tasks.length, 1);
    assert.equal(exported.memory?.artifacts.length, 2);
    const entry = exported.memory!.entries.find((item) => item.title === "Decision")!;
    const selected = selectConfiguration(exported, [], [], [entry.id]);
    assert.equal(selectConfiguration(exported, [], []).memory, undefined);
    assert.equal(selectConfiguration(exported, [], [], [exported.memory!.entries.find((item) => item.title === "Independent")!.id]).memory!.tasks.length, 0);
    for (let index = 0; index < 2; index++) target.importConfiguration(selected);
    const imported = target.searchMemory().entries;
    assert.equal(imported.length, 2);
    assert.equal(target.list().length, 0);
    const targetArtifacts = new ArtifactStore(target.databasePath, target.workspaceId);
    try {
      assert.equal(targetArtifacts.list().length, 0);
      assert.equal(targetArtifacts.list({ archived: true }).length, 4);
    } finally { targetArtifacts.close(); }
    for (const memory of imported) {
      assert.notEqual(memory.id, entry.id);
      const task = target.memoryEvidence(memory.id)[0];
      assert.ok(task.archivedAt);
      assert.notEqual(task.id, "source-task");
      assert.equal(task.comments?.length, 1);
      assert.doesNotMatch(task.comments![0].body, new RegExp(file.id));
    }
    const roundTrip = target.exportConfiguration().memory!;
    assert.equal(roundTrip.tasks.length, 2);
    assert.equal(roundTrip.artifacts.filter((item) => item.content === Buffer.from([0, 1, 128, 255]).toString("base64")).length, 2);
    assert.equal(source.readTask("source-task")?.archivedAt, null);
    assert.equal(artifacts.list().length, 3);
    assert.deepEqual(source.exportConfiguration(), exported);
    const before = target.exportConfiguration();
    const invalid = structuredClone(selected);
    invalid.memory!.artifacts[0].content = "invalid base64!";
    assert.throws(() => target.importConfiguration(invalid), /Invalid memory/);
    assert.deepEqual(target.exportConfiguration(), before);
    const targetDb = new DatabaseSync(target.databasePath);
    try {
      targetDb.exec("CREATE TRIGGER reject_memory BEFORE INSERT ON memory_entries BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
      assert.throws(() => target.importConfiguration(selected), /test rollback/);
      assert.deepEqual(target.exportConfiguration(), before);
      assert.equal(targetDb.prepare("SELECT COUNT(*) AS count FROM tasks").get()!.count, 2);
      assert.equal(targetDb.prepare("SELECT COUNT(*) AS count FROM artifacts").get()!.count, 4);
    } finally { targetDb.close(); }

  } finally { db.close(); artifacts.close(); source.close(); target.close(); rmSync(directory, { recursive: true, force: true }); }
});
