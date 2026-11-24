import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RunHistoryEntry } from "../src/domain/execution.ts";
import { activitySummary } from "../src/domain/activity-summary.ts";

const source = fileURLToPath(new URL("../src/components/tasks/task-comments.tsx", import.meta.url));
// Replace only the network hook. Exercise the actual Activity tree and shared UI components.
const { outputFiles } = await import("esbuild").then(({ build }) => build({
  entryPoints: [source], bundle: true, packages: "external", platform: "node", format: "cjs", write: false,
  plugins: [{ name: "recorded-activity", setup(build) {
    build.onLoad({ filter: /use-run-history\.ts$/ }, () => ({ contents: 'export const loadRunHistory = () => {}; export const useRunHistory = () => require("activity-test-data");', loader: "ts" }));
  } }],
}));
const loaded = { exports: {} as { TaskComments: ComponentType<Record<string, unknown>> } };
const require = createRequire(import.meta.url);
const recorded = { runs: [] as RunHistoryEntry[], error: false, retry: () => {} };
new Function("require", "module", "exports", outputFiles![0].text)((id: string) => id === "activity-test-data" ? recorded : require(id), loaded, loaded.exports);
const steps = [
  { id: "memory", title: "Checking memories for sign-in", status: "complete" as const, createdAt: "", updatedAt: "" },
  { id: "worktree", title: "Creating a worktree", status: "complete" as const, createdAt: "", updatedAt: "" },
  { id: "test", title: "npm test -- --runInBand", detail: "Secret raw CLI output", status: "running" as const, createdAt: "", updatedAt: "" },
];
const run: RunHistoryEntry = { id: "run", agentName: "Builder", status: "Running", activity: steps, createdAt: "", startedAt: null, finishedAt: null, summary: null };

test("live Activity renders ordered summaries without a history accordion or commands", () => {
  recorded.runs = [run];
  const html = renderToStaticMarkup(createElement(loaded.exports.TaskComments, { taskId: "task", agentStatus: "Running" }));
  assert.match(html, /Builder is working/);
  assert.equal((html.match(/animate-spin motion-reduce:animate-none/g) ?? []).length, 2);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Running tests/);
  assert.ok(html.indexOf("Checked memories for sign-in") < html.indexOf("Created a worktree"));
  assert.ok(html.indexOf("Created a worktree") < html.indexOf("Running tests"));
  assert.doesNotMatch(html, /Run history|npm test|runInBand|Secret raw/);
});

test("completed execution is collapsed below the comment header and above its body", () => {
  recorded.runs = [{ ...run, status: "Complete", activity: steps.map(step => ({ ...step, status: "complete" })) }];
  const html = renderToStaticMarkup(createElement(loaded.exports.TaskComments, {
    taskId: "task", agentStatus: "Complete", comments: [{ id: "comment", taskId: "task", runId: "run", authorName: "Builder", body: "The page is ready.", createdAt: "2026-11-24T10:00:00Z" }],
  }));
  assert.match(html, /aria-expanded="false"[^>]*>[\s\S]*?3 steps/);
  assert.ok(html.indexOf('data-slot="message-header"') < html.indexOf("3 steps"));
  assert.ok(html.indexOf("3 steps") < html.indexOf("The page is ready."));
  assert.doesNotMatch(html, /Run history|npm test|Secret raw/);
});

test("operation summaries do not mistake search arguments for commands", () => {
  assert.equal(activitySummary({ id: "a", title: "rg typecheck src", status: "running" }), "Searching files for typecheck");
  assert.equal(activitySummary({ id: "a", title: "Read: src/test.ts", status: "running" }), "Reading `src/test.ts`");
  assert.equal(activitySummary({ id: "a", title: "npm test", status: "error" }), "Failed to run tests");
});

test("live activity keeps five recent steps and completed comments keep every step", () => {
  const activity = Array.from({ length: 17 }, (_, index) => ({ ...steps[0], id: `step-${index}`, title: `Read: file-${index}.md` }));
  recorded.runs = [{ ...run, activity }];
  const live = renderToStaticMarkup(createElement(loaded.exports.TaskComments, { taskId: "task", agentStatus: "Running" }));
  assert.match(live, /12\+ more/);
  assert.doesNotMatch(live, /file-0\.md|file-11\.md/);
  assert.match(live, /<code[^>]*>file-12\.md<\/code>/);
  assert.match(live, /file-16\.md/);
  assert.equal((live.match(/data-slot="trace-line"[^>]*role="listitem"/g) ?? []).length, 6);
  recorded.runs = [{ ...run, status: "Complete", activity }];
  const finished = renderToStaticMarkup(createElement(loaded.exports.TaskComments, {
    taskId: "task", agentStatus: "Complete", comments: [{ id: "final", taskId: "task", runId: "run", authorName: "Builder", body: "Done.", createdAt: "2026-11-24T10:00:00Z" }],
  }));
  assert.match(finished, /17 steps/);
  assert.match(finished, /file-0\.md/);
  assert.match(finished, /file-16\.md/);
  assert.doesNotMatch(finished, /\+ more/);
});

test("file and tool summaries identify their subject and use the recorded status", () => {
  assert.equal(activitySummary({ id: "a", title: "my_tool", toolName: "my_tool", status: "complete" }), "Used `my_tool` tool");
  assert.equal(activitySummary({ id: "a", title: "my_tool", toolName: "my_tool", status: "error" }), "Failed to use `my_tool` tool");
  assert.equal(activitySummary({ id: "a", title: "cua_repl: js", toolName: "js", status: "error" }), "Failed to use `cua_repl.js` tool");
  assert.equal(activitySummary({ id: "a", title: "node_repl: js", status: "error" }), "Failed to use `node_repl.js` tool");
  assert.equal(activitySummary({ id: "a", title: 'cat "my file.md"', status: "running" }), "Reading `my file.md`");
  assert.equal(activitySummary({ id: "a", title: "sed -n '1,20p' src/app.ts", status: "complete" }), "Read `src/app.ts`");
  assert.equal(activitySummary({ id: "a", title: "cat a.md b.md; npm test", status: "running" }), "Reading `a.md`, `b.md`");
  assert.equal(activitySummary({ id: "a", title: "Read", filePath: "myfile.md", status: "error" }), "Failed to read `myfile.md`");
});

test("completed comments show the recorded final duration next to the step count", () => {
  recorded.runs = [{ ...run, status: "Complete", startedAt: "2026-11-24T10:00:00Z", finishedAt: "2026-11-24T10:01:23Z" }];
  const html = renderToStaticMarkup(createElement(loaded.exports.TaskComments, {
    taskId: "task", agentStatus: "Complete", comments: [{ id: "timed", taskId: "task", runId: "run", authorName: "Builder", body: "Done.", createdAt: "2026-11-24T10:01:23Z" }],
  }));
  assert.match(html, /dateTime="PT83S"/i);
  assert.match(html, /aria-label="Duration: 1m 23s"/);
  assert.ok(html.indexOf("3 steps") < html.indexOf("Duration: 1m 23s"));
});
