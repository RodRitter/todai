import { withTaskStore } from "@/server/database";
import { workspacePath } from "@/server/workspace-settings";
import { fileReferences, skillReferences } from "@/server/task-references";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  if (kind !== "skill" && kind !== "file") {
    return Response.json({ error: "Choose skills or files." }, { status: 400 });
  }
  try {
    const workspace = withTaskStore(request, workspacePath);
    const query = (params.get("q") ?? "").slice(0, 200);
    return Response.json({ references: kind === "skill"
      ? skillReferences(workspace, query)
      : await fileReferences(workspace, query) });
  } catch {
    return Response.json({ error: "Could not load references. Check workspace access and try again." }, { status: 500 });
  }
}
