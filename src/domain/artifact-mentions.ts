import type { ArtifactReference } from "./artifact.ts";

export function artifactMentionPath(ref: ArtifactReference) {
  return `#artifact/${encodeURIComponent(ref.artifactId)}`;
}

export function parseArtifactMention(path: string): ArtifactReference | null {
  // Accept old revision links, but always open the current document.
  const match = /^#artifact\/([\w-]+)(?:\/[\w-]+)?$/.exec(path);
  return match ? { artifactId: match[1] } : null;
}
