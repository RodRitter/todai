import type { ArtifactReference } from "./artifact.ts";

export function artifactMentionPath(ref: ArtifactReference) {
  return `#artifact/${encodeURIComponent(ref.artifactId)}/${encodeURIComponent(ref.revisionId)}`;
}

export function parseArtifactMention(path: string): ArtifactReference | null {
  const match = /^#artifact\/([\w-]+)\/([\w-]+)$/.exec(path);
  return match ? { artifactId: match[1], revisionId: match[2] } : null;
}
