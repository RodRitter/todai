import { artifactFailure, withArtifactStore } from "@/server/artifact-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const { artifact, bytes } = withArtifactStore(request, (store) => store.download(new URL(request.url).searchParams.get("id") ?? ""));
    const filename = encodeURIComponent(artifact.filename!).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": artifact.mediaType!,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="artifact"; filename*=UTF-8''${filename}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    } });
  } catch (error) { return artifactFailure(error); }
}
