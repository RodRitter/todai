import assert from "node:assert/strict";
import test from "node:test";
import { getSchema, isActive } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { referenceMatch } from "../components/tasks/description-references.ts";

const schema = getSchema([StarterKit]);
function replacementState(prefix = "See ", suffix = "") {
  const link = schema.marks.link.create({ href: "https://example.com/document" });
  const doc = schema.node("doc", null, schema.node("paragraph", null, [
    ...(prefix ? [schema.text(prefix)] : []), schema.text("Document", [link]),
    ...(suffix ? [schema.text(suffix)] : []),
  ]));
  const from = prefix.length + 1;
  let state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, from, from + 8) });
  state = state.apply(state.tr.insertText("#Notes"));
  return state;
}
function match(state: EditorState) {
  return referenceMatch({ state }, false, true);
}
test("artifact tagging works when replacing a pasted link", () => {
  const state = replacementState();
  assert.equal(state.doc.textContent, "See #Notes");
  assert.equal(state.selection.empty, true);
  assert.equal(isActive(state, "link"), true);
  assert.deepEqual(match(state), { from: 5, to: 11, kind: "artifact", query: "Notes" });
});

test("tag replacement works at paragraph start and before remaining text", () => {
  assert.deepEqual(match(replacementState("", " for context")), { from: 1, to: 7, kind: "artifact", query: "Notes" });
});
test("URL fragments do not trigger artifact tagging", () => {
  const text = "https://example.com/#Notes";
  const doc = schema.node("doc", null, schema.node("paragraph", null, schema.text(text)));
  assert.equal(match(EditorState.create({ schema, doc, selection: TextSelection.create(doc, text.length + 1) })), null);
});
test("code blocks do not trigger artifact tagging", () => {
  const doc = schema.node("doc", null, schema.node("codeBlock", null, schema.text("#Notes")));
  assert.equal(match(EditorState.create({ schema, doc, selection: TextSelection.create(doc, 7) })), null);
});
