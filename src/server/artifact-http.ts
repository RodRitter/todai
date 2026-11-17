import { resolve } from "node:path";
import { ArtifactError, ArtifactTooLargeError, ArtifactStore } from "./artifact-store.ts";
import { WorkspaceOwnershipError } from "./task-store.ts";
import { MAX_ARTIFACT_BYTES } from "../domain/artifact.ts";

export function withArtifactStore<T>(request: Request, operation: (store: ArtifactStore) => T): T {
  const workspaceId = request.headers.get("X-Todai-Workspace");
  if (!workspaceId) throw new WorkspaceOwnershipError("A workspace ID is required. Reload the page.");
  const store = new ArtifactStore(resolve(process.env.TODAI_DB_PATH ?? ".todai/tasks.sqlite"), workspaceId);
  try { return operation(store); } finally { store.close(); }
}

export function artifactFailure(error: unknown) {
  if (error instanceof WorkspaceOwnershipError)
    return Response.json({ error: error.message }, { status: 403 });
  if (error instanceof ArtifactError)
    return Response.json({ error: error.message }, { status: error instanceof ArtifactTooLargeError ? 413 : 400 });
  return Response.json({ error: "Could not access artifact storage. Check available disk space and database access, then retry." }, { status: 500 });
}

// Bound actual bytes before multipart parsing, including requests without Content-Length.
export async function artifactForm(request: Request) {
  const maximum = MAX_ARTIFACT_BYTES + 64 * 1024;
  const reader = request.body?.getReader();
  if (!reader) throw new ArtifactError("Choose content to publish.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ArtifactTooLargeError("Artifacts must be 20 MiB or smaller; metadata must fit within 64 KiB.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("Content-Type") ?? "" } }).formData();
  } catch { throw new ArtifactError("Send artifact fields as multipart form data."); }
}
