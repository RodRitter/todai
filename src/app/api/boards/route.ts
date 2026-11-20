import { withTaskStore } from "../../../server/database.ts";
import { ColumnValidationError } from "../../../server/task-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const headers = new Headers(request.headers);
    headers.delete("X-Todai-Board");
    return Response.json(withTaskStore(new Request(request, { headers }), (store) => store.listBoards()));
  } catch {
    return Response.json({ error: "Could not load boards. Choose a workspace and try again." }, { status: 400 });
  }
}

async function update(request: Request) {
  try {
    const { id, name } = await request.json();
    if (request.method !== "POST" && typeof id !== "string") throw new ColumnValidationError("Choose a board.");
    const headers = new Headers(request.headers);
    headers.delete("X-Todai-Board");
    const result = withTaskStore(new Request(request.url, { headers }), (store) => request.method === "DELETE" ? store.deleteBoard(id) : store.saveBoard(name, request.method === "PATCH" ? id : undefined));
    return request.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof ColumnValidationError ? error.message : "Could not save boards. Try again." }, { status: 400 });
  }
}
export const POST = update;
export const PATCH = update;
export const DELETE = update;
