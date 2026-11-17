import { artifactFailure, artifactForm, withArtifactStore } from "@/server/artifact-http";
import { ArtifactError } from "@/server/artifact-store";
import type { ArtifactType } from "@/domain/artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(withArtifactStore(request, (store) => params.has("id")
      ? store.read(params.get("id")!)
      : store.list({ search: params.get("search") ?? "", type: params.get("type") ?? "", creator: params.get("creator") ?? "" })));
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
    const artifact = withArtifactStore(request, (store) => store.create({
      title: field("title"), description: field("description"), creator: field("creator"),
      type: field("type") as ArtifactType, content: field("content"), url: field("url"),
      bytes, filename: file instanceof File ? file.name : undefined,
      mediaType: file instanceof File ? file.type : undefined,
    }));
    return Response.json(artifact, { status: 201 });
  } catch (error) { return artifactFailure(error); }
}
