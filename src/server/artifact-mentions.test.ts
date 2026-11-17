import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { artifactMentions } from "./artifact-mentions.ts";
import { artifactMentionPath } from "../domain/artifact-mentions.ts";

test("editor Markdown round trips preserve pinned citations and other reference kinds", () => {
  const markdown = new MarkdownManager({ extensions: [StarterKit] });
  const path = artifactMentionPath({ artifactId: "artifact-one", revisionId: "revision-one" });
  const doc = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Design [draft] & notes", marks: [{ type: "link", attrs: { href: path } }] },
    { type: "text", text: " and " },
    { type: "text", text: "@Reviewer", marks: [{ type: "link", attrs: { href: "#agent/reviewer" } }] },
  ] }] };
  const saved = markdown.serialize(doc);
  const reloaded = markdown.serialize(markdown.parse(saved));
  assert.deepEqual(artifactMentions(reloaded), [{ artifactId: "artifact-one", revisionId: "revision-one" }]);
  assert.match(reloaded, /#agent\/reviewer/);
  assert.match(reloaded, /Design/);
});

test("Markdown reference links are tracked but code examples, images and ordinary links are not", () => {
  const body = '[Evidence][ref]\n\n[ref]: #artifact/one/rev\n\n`[example](#artifact/invalid)`\n\n```md\n[example](#artifact/invalid)\n```\n\n![image](#artifact/invalid) [external](https://example.com/#artifact/invalid)';
  assert.deepEqual(artifactMentions(body), [{ artifactId: "one", revisionId: "rev" }]);
});

test("entity-escaped Markdown citations receive the same associations as rendered mentions", () => {
  assert.deepEqual(artifactMentions('[Evidence](#art&#105;fact/one/rev)'), [{ artifactId: "one", revisionId: "rev" }]);
});
