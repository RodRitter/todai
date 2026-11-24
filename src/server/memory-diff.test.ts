import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryChangeRecommendation } from "./memory-diff.ts";

test("memory differences show additions, removals, and replacements without unchanged entries", () => {
  const result = memoryChangeRecommendation(
    "## Terms\nKeep this term.\nOld term.\n## Practices\nRemove this practice.\n## Decisions\nKeep this decision.\n## Preferences",
    "## Terms\nKeep this term.\nNew term.\n## Practices\n## Decisions\nKeep this decision.\n## Preferences\nNew preference.",
  );
  assert.match(result, /@@ -3,1 \+3,1 @@\n-Old term\.\n\+New term\./);
  assert.match(result, /@@ -5,1 \+4,0 @@\n-Remove this practice\./);
  assert.match(result, /@@ -8,0 \+8,1 @@\n\+New preference\./);
  assert.doesNotMatch(result, /Keep this|## Terms|## Practices|## Decisions|## Preferences/);
});

test("repeated lines retain their occurrence counts", () => {
  assert.match(memoryChangeRecommendation("same\nsame\nend", "same\nend"), /@@ -[12],1 \+\d,0 @@\n-same\n```$/);
  assert.match(memoryChangeRecommendation("same\nend", "same\nsame\nend"), /@@ -\d,0 \+[12],1 @@\n\+same\n```$/);
});

test("memory code fences cannot close the difference block", () => {
  const result = memoryChangeRecommendation("## Terms", "## Terms\n```text\nExample\n```");
  assert.match(result, /````diff\n/);
  assert.ok(result.endsWith("\n````"));
  assert.match(result, /\+```text\n\+Example\n\+```/);
});
