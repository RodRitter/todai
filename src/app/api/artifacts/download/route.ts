import { artifactPreviewKind } from "../../../../domain/artifact.ts";
import { artifactFailure, withArtifactStore } from "../../../../server/artifact-http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { artifact, bytes } = withArtifactStore(request, (store) => store.download(params.get("id") ?? "", params.get("revision") ?? undefined));
    const preview = params.get("preview") === "true";
    const kind = artifactPreviewKind(artifact);
    if (preview && kind === "unsupported") return Response.json({ error: "Preview unavailable for this file type. Download the stored file instead." }, { status: 415 });
    const filename = encodeURIComponent(artifact.filename!).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": preview && (kind === "text" || kind === "markdown") ? "text/plain; charset=utf-8" : artifact.mediaType!,
      ...(preview ? { "X-Todai-Preview": kind } : {}),
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="artifact"; filename*=UTF-8''${filename}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    } });
  } catch (error) { return artifactFailure(error); }
}
