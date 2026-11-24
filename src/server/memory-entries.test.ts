import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./task-store.ts";
import { initializeMemoryEntries, prepareMemoryChanges, applyMemoryChanges, searchMemoryEntries, memoryContext, readMemoryEntries, replaceLegacyEntries } from "./memory-entries.ts";

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE workspaces(id TEXT PRIMARY KEY); INSERT INTO workspaces VALUES ('one'), ('two'); CREATE TABLE memory_reviews(runId TEXT); CREATE TABLE workspace_memory(workspaceId TEXT, revision INTEGER, document TEXT);");
  initializeMemoryEntries(db);
  return db;
}
const addition = { operation: "add", category: "Practices", title: "Settings feedback", statement: "Use shared toast helpers.", scope: "Settings forms", source: "[Task](/?task=one)", reason: "The task confirmed this practice." };

test("memory search ranks titles, isolates workspaces, and returns exact entries separately", () => {
  const db = setup();
  try {
    const changes = prepareMemoryChanges(db, "one", [addition, { ...addition, title: "Release checks", statement: "Run lint before release." }]);
    applyMemoryChanges(db, "one", changes);
    applyMemoryChanges(db, "two", prepareMemoryChanges(db, "two", [{ ...addition, statement: "Private other workspace memory." }]));
    const result = searchMemoryEntries(db, "one", "settings");
    assert.equal(result.entries[0].title, "Settings feedback");
    assert.equal(result.total, 2);
    assert.equal(readMemoryEntries(db, "one", [changes[0].after!.id])[0].statement, addition.statement);
    assert.throws(() => readMemoryEntries(db, "two", [changes[0].after!.id]), /unavailable/);
    assert.throws(() => readMemoryEntries(db, "one", Array(6).fill("id")), /at most five/);
    assert.equal(searchMemoryEntries(db, "one", '" OR * :').total, 0);
  } finally { db.close(); }
});

test("memory pages and initial context stay bounded as the store grows", () => {
  const db = setup();
  try {
    for (let index = 0; index < 45; index++) applyMemoryChanges(db, "one", prepareMemoryChanges(db, "one", [{ ...addition, title: `Settings ${String(index).padStart(2, "0")}`, statement: `Settings ${index}. ${"Long statement. ".repeat(30)}` }]));
    const first = searchMemoryEntries(db, "one");
    const second = searchMemoryEntries(db, "one", "", 20);
    const third = searchMemoryEntries(db, "one", "", 40);
    assert.deepEqual([first.entries.length, second.entries.length, third.entries.length], [20, 20, 5]);
    assert.equal(first.total, 45);
    assert.ok(first.hasMore && second.hasMore && !third.hasMore);
    assert.equal(new Set([...first.entries, ...second.entries, ...third.entries].map((item) => item.id)).size, 45);
    const context = memoryContext(db, "one", "Settings");
    assert.equal(context.total, 45);
    assert.ok(context.entries.length > 0 && context.entries.length <= 5);
    assert.ok(JSON.stringify(context.entries).length <= 4010);
    assert.deepEqual(memoryContext(db, "one", "unrelated").entries, []);
  } finally { db.close(); }
});

test("migration preserves accepted text, indexes it once, and retains source links", () => {
  const db = setup();
  try {
    const original = "Use shared toast helpers. Scope: settings. [Source](/?task=one)";
    db.prepare("INSERT INTO workspace_memory VALUES ('one', 1, ?)").run(`## Terms\n\n## Practices\n\n${original}\n\n## Decisions\n\n## Preferences`);
    initializeMemoryEntries(db);
    const entry = searchMemoryEntries(db, "one", "toast").entries[0];
    assert.equal(entry.statement, "Use shared toast helpers. Scope: settings. [Task one](#task/one)");
    assert.equal(entry.category, "Practices");
    initializeMemoryEntries(db);
    assert.equal(searchMemoryEntries(db, "one").entries[0].id, entry.id);
    replaceLegacyEntries(db, "one", "## Terms\n\nReplacement");
    assert.equal(searchMemoryEntries(db, "one", "toast").total, 0);
  } finally { db.close(); }
});

test("structured proposals reject malformed fields, unknown IDs, and repeated changes", () => {
  const db = setup();
  try {
    assert.throws(() => prepareMemoryChanges(db, "one", [{ ...addition, statement: "x".repeat(601) }]), /statement/);
    assert.throws(() => prepareMemoryChanges(db, "one", [{ ...addition, category: "Invalid" }]), /category/);
    assert.throws(() => prepareMemoryChanges(db, "one", [{ ...addition, operation: "remove", id: "missing", revision: 1 }]), /unavailable/);
    const changes = prepareMemoryChanges(db, "one", [addition]); applyMemoryChanges(db, "one", changes);
    const change = { ...addition, operation: "update", id: changes[0].after!.id, revision: 1 };
    assert.throws(() => prepareMemoryChanges(db, "one", [change, change]), /one change/);
  } finally { db.close(); }
});

test("automatic memory updates are atomic, reject stale revisions, and support removals", () => {
  const store = new TaskStore(":memory:");
  try {
    store.setWorkspacePath("/private/tmp");
    store.renameColumn("Done", "Done", undefined, true);
    const review = (taskId: string, changes: unknown[]) => {
      store.save({ id: taskId, title: "Settings", description: "", status: "Done" });
      const run = store.claimRun()!;
      try { store.finishRun(run.id, "Complete", JSON.stringify({ changes })); }
      catch (error) { store.finishRun(run.id, "Failed", String(error)); throw error; }
      return store.list().find((task) => task.id === taskId)!.comments!.at(-1)!;
    };
    const first = review("one", [addition]);
    assert.match(first.body, /1 added/);
    assert.equal(first.feedbackStatus, null);
    review("two", [{ ...addition, title: "Checks", statement: "Run checks." }]);
    const current = store.searchMemory("toast").entries[0];
    const update = { ...addition, operation: "update", id: current.id, revision: current.revision, statement: "Use notifyOperation for save feedback." };
    review("three", [update]);
    assert.throws(() => review("four", [{ ...addition, statement: "Should roll back." }, update]), /Memory entry changed/);
    assert.equal(store.searchMemory().total, 2);
    assert.equal(store.readMemoryEntries([current.id])[0].revision, 2);
    review("five", [{ operation: "remove", id: current.id, revision: 2, reason: "Retired rule." }]);
    assert.equal(store.searchMemory().total, 1);
    assert.throws(() => store.readMemoryEntries([current.id]), /unavailable/);
  } finally { store.close(); }
});
