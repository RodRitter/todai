export const artifactTypes = ["text", "markdown", "file", "link"] as const;
export type ArtifactType = (typeof artifactTypes)[number];
export const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;
export type Artifact = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  type: ArtifactType;
  creator: string;
  createdAt: string;
  updatedAt: string;
  filename: string | null;
  mediaType: string | null;
  byteSize: number | null;
  url: string | null;
};
export type ArtifactInput = {
  title: string;
  description?: string;
  type: ArtifactType;
  creator: string;
  content?: string;
  bytes?: Uint8Array;
  filename?: string;
  mediaType?: string;
  url?: string;
};
export type ArtifactFilters = { search?: string; type?: string; creator?: string };
