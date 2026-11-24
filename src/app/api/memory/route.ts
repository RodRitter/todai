import { withTaskStore } from "../../../server/database.ts";
import { WorkspaceOwnershipError } from "../../../server/task-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const headers = new Headers(request.headers);
    headers.delete("X-Todai-Board");
    const params = new URL(request.url).searchParams;
    const snapshot = withTaskStore(new Request(request, { headers }), (store) => params.get("view") === "entries"
      ? store.searchMemory(params.get("query") ?? "", Number(params.get("offset") ?? 0)) : store.memorySnapshot());
    return Response.json(snapshot);
  } catch (error) {
    return Response.json({ error: "Could not load workspace memory. Choose a workspace and try again." },
      { status: error instanceof WorkspaceOwnershipError ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body?.confirmation !== "clear-memory") return Response.json({ error: "Confirm that you want to clear workspace memory." }, { status: 400 });
    const headers = new Headers(request.headers);
    headers.delete("X-Todai-Board");
    const result = withTaskStore(new Request(request.url, { headers }), (store) => store.clearMemory());
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: "Could not clear workspace memory. Try again." },
      { status: error instanceof WorkspaceOwnershipError ? 400 : 500 });
  }
}
