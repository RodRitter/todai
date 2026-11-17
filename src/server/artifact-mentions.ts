import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent } from "mdast";
import { parseArtifactMention } from "../domain/artifact-mentions.ts";
import type { ArtifactReference } from "../domain/artifact.ts";

// Match the saved comment renderer, including entities and reference-style links.
const markdown = unified().use(remarkParse).use(remarkGfm);

export function artifactMentions(body: string): ArtifactReference[] {
  const tree = markdown.parse(body);
  const definitions = new Map<string, string>();
  const references: ArtifactReference[] = [];
  function visit(node: Root | RootContent, action: (node: Root | RootContent) => void) {
    action(node);
    if ("children" in node) for (const child of node.children) visit(child, action);
  }
  visit(tree, (node) => {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
  });
  visit(tree, (node) => {
    const path = node.type === "link" ? node.url : node.type === "linkReference" ? definitions.get(node.identifier) : undefined;
    if (!path?.startsWith("#artifact/")) return;
    const ref = parseArtifactMention(path);
    if (!ref) throw new Error("Choose a valid artifact revision reference.");
    references.push(ref);
  });
  return references;
}
