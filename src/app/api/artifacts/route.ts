import { artifactFailure, artifactForm, withArtifactStore } from "../../../server/artifact-http.ts";
import { ArtifactError } from "../../../server/artifact-store.ts";
import type { ArtifactInput, ArtifactType } from "../../../domain/artifact.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(withArtifactStore(request, (store) => params.has("id")
      ? params.get("history") === "true" ? store.history(params.get("id")!) : store.read(params.get("id")!, params.get("revision") ?? undefined)
      : store.list({ archived: params.get("archived") === "true", search: params.get("search") ?? "", type: params.get("type") ?? "", creator: params.get("creator") ?? "" })));
  } catch (error) { return artifactFailure(error); }
}

export async function POST(request: Request) {
  try {
    withArtifactStore(request, () => undefined);
    const form = await artifactForm(request);
    const field = (key: string) => {
      const value = form.get(key);
      if (value !== null && typeof value !== "string") throw new ArtifactError(`Invalid ${key}.`);
      return value ?? "";
    };
    const file = form.get("file");
    const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : undefined;
    const input: ArtifactInput = {
      title: field("title"), description: field("description"), creator: field("creator"),
      type: field("type") as ArtifactType, content: field("content"), url: field("url"),
      bytes, filename: file instanceof File ? file.name : undefined,
      mediaType: file instanceof File ? file.type : undefined,
    };
    const artifact = withArtifactStore(request, (store) => field("id") ? store.revise(field("id"), input) : store.create(input));
    return Response.json(artifact, { status: 201 });
  } catch (error) { return artifactFailure(error); }
}

// Human library control; not part of agent publication capabilities.
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body.id !== "string") throw new ArtifactError("An artifact ID is required.");
    return Response.json(withArtifactStore(request, (store) => store.archive(body.id)));
  } catch (error) { return artifactFailure(error); }
}
