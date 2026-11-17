export const artifactTypes = ["text", "markdown", "file", "link"] as const;
export type ArtifactType = (typeof artifactTypes)[number];
export const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;
export type Artifact = {
  id: string;
  revisionId: string;
  revisionNumber: number;
  runId?: string | null;
  taskId?: string | null;
  archived: boolean;
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
export type ArtifactFilters = { taskId?: string; archived?: boolean; search?: string; type?: string; creator?: string };

export type ArtifactReference = { artifactId: string; revisionId: string };
export type TaskArtifact = { artifact: Artifact; explicit: boolean; comments: { commentId: string; artifact: Artifact }[] };
