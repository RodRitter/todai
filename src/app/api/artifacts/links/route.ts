import { artifactFailure, withArtifactStore } from "../../../../server/artifact-http.ts";
import { ArtifactError } from "../../../../server/artifact-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId") ?? "";
    return Response.json(withArtifactStore(request, (store) => store.forTask(taskId)));
  } catch (error) { return artifactFailure(error); }
}

async function changeLink(request: Request, remove: boolean) {
  try {
    const data = await request.json();
    if (!data || typeof data.taskId !== "string" || typeof data.artifactId !== "string")
      throw new ArtifactError("Choose a task and artifact.");
    return Response.json(withArtifactStore(request, (store) => {
      if (remove) store.unlinkTask(data.taskId, data.artifactId);
      else store.linkTask(data.taskId, data.artifactId);
      return store.forTask(data.taskId);
    }));
  } catch (error) { return artifactFailure(error); }
}

export function POST(request: Request) { return changeLink(request, false); }
export function DELETE(request: Request) { return changeLink(request, true); }
