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
    assert.ok(context.entries.length > 0 && context.entries.length > 5);
    assert.ok(JSON.stringify(context.entries).length <= 8000);
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


test("concept retrieval finds related terms and searches detailed evidence", () => {
  const db = setup();
  try {
    applyMemoryChanges(db, "one", prepareMemoryChanges(db, "one", [
      { ...addition, details: "The retry control remains available after a timeout." },
      { ...addition, title: "Sign in", statement: "Validate credentials.", scope: "Authentication" },
    ]));
    assert.equal(searchMemoryEntries(db, "one", "notifications").entries[0].title, "Settings feedback");
    assert.equal(searchMemoryEntries(db, "one", "login").entries[0].title, "Sign in");
    assert.equal(searchMemoryEntries(db, "one", "timeout").entries[0].title, "Settings feedback");
    assert.equal(searchMemoryEntries(db, "two", "login").total, 0);
    assert.equal(searchMemoryEntries(db, "one", "gardening").total, 0);
    assert.ok(JSON.stringify(memoryContext(db, "one", "settings", 500).entries).length <= 500);
  } finally { db.close(); }
});

test("review flags exclude uncertain records and details survive updates", () => {
  const db = setup();
  try {
    const changes = prepareMemoryChanges(db, "one", [{ ...addition, details: "Evidence. ".repeat(500), needsReview: true }]);
    applyMemoryChanges(db, "one", changes);
    const saved = changes[0].after!;
    assert.equal(memoryContext(db, "one", "settings").entries.length, 0);
    applyMemoryChanges(db, "one", prepareMemoryChanges(db, "one", [{ ...addition, operation: "update", id: saved.id, revision: 1, needsReview: false }]));
    assert.equal(readMemoryEntries(db, "one", [saved.id])[0].details, saved.details);
    assert.equal(memoryContext(db, "one", "settings").entries.length, 1);
    assert.equal(memoryContext(db, "one", "settings").entries[0].details, "");
  } finally { db.close(); }
});

test("replacement retains history and rejects cross-workspace replacement", () => {
  const store = new TaskStore(":memory:");
  try {
    store.changeMemory(addition);
    const original = store.searchMemory().entries[0];
    store.changeMemory({ ...addition, statement: "Use the new helper.", supersedes: original.id });
    assert.equal(store.searchMemory().total, 1);
    assert.equal(store.memoryHistory(original.id).length, 2);
    assert.match(store.memoryHistory(original.id)[0].reason, /Replaced by/);
    assert.throws(() => store.changeMemory({ ...addition, supersedes: "missing" }), /unavailable/);
    const replacement = store.searchMemory().entries[0];
    store.changeMemory({ operation: "remove", id: replacement.id, revision: replacement.revision, reason: "Outdated." });
    assert.equal(store.searchMemory().total, 0);
    assert.equal(store.memoryHistory(replacement.id).length, 2);
    store.clearMemory();
    assert.equal(store.memoryHistory(original.id).length, 0);
  } finally { store.close(); }
});

test("conflicting records are both withheld until reviewed", () => {
  const store = new TaskStore(":memory:");
  try {
    store.changeMemory(addition);
    store.changeMemory({ ...addition, statement: "Use inline status messages." });
    assert.ok(store.searchMemory().entries.every((entry) => entry.needsReview));
    assert.equal(store.memoryContext("settings").entries.length, 0);
    const conflict = store.searchMemory().entries.find((entry) => entry.statement.includes("inline"))!;
    store.changeMemory({ operation: "remove", id: conflict.id, revision: conflict.revision, reason: "Contradicts the current rule." });
    const accepted = store.searchMemory().entries[0];
    store.changeMemory({ ...accepted, operation: "update", needsReview: false, reason: "Checked the source." });
    assert.equal(store.memoryContext("settings").entries.length, 1);
    assert.equal(store.searchMemory("", 0, 20, true).total, 2);
  } finally { store.close(); }
});

test("normalized duplicates and invalid details do not alter accepted memory", () => {
  const store = new TaskStore(":memory:");
  try {
    store.changeMemory(addition);
    assert.throws(() => store.changeMemory({ ...addition, statement: "USE shared toast helpers!" }), /already exists/);
    assert.throws(() => store.changeMemory({ ...addition, details: "x".repeat(12001) }), /details/);
    assert.throws(() => store.changeMemory({ ...addition, needsReview: "yes" }), /boolean/);
    assert.equal(store.searchMemory().total, 1);
  } finally { store.close(); }
});

test("memory evidence returns original tasks and omits unavailable sources", () => {
  const store = new TaskStore(":memory:");
  try {
    store.save({ id: "source", title: "Source decision", description: "Verified evidence.", status: "To do" });
    store.changeMemory({ ...addition, source: "[Task source](#task/source)" });
    const entry = store.searchMemory().entries[0];
    assert.equal(store.memoryEvidence(entry.id)[0].description, "Verified evidence.");
    store.changeMemory({ ...entry, operation: "update", source: "[Missing](#task/foreign)", reason: "Test source ownership." });
    assert.deepEqual(store.memoryEvidence(entry.id), []);
  } finally { store.close(); }
});
