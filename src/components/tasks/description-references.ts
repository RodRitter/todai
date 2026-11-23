import type { Editor } from "@tiptap/react";

export type Match = { from: number; to: number; kind: "skill" | "file" | "all" | "artifact"; query: string };
export function referenceMatch(editor: Pick<Editor, "state">, allowArtifacts: boolean): Match | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.spec.code) return null;
  // Replacing pasted link text can retain its link mark; match the text regardless.
  const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
  const match = /(?:^|\s)([$@/#])([^\s$@#]*)$/.exec(before);
  if (!match || (match[1] === "#" && !allowArtifacts)) return null;
  return { from: $from.pos - match[2].length - 1, to: $from.pos, kind: match[1] === "#" ? "artifact" : match[1] === "$" ? "skill" : match[1] === "@" ? "all" : "file", query: match[2] };
}

