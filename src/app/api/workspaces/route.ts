import { openTaskStore, withTaskStore } from "../../../server/database.ts";
import { WorkspaceOwnershipError } from "../../../server/task-store.ts";
import { WorkspaceValidationError } from "../../../server/workspace-settings.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const store = openTaskStore();
  try { return Response.json(store.listWorkspaces()); }
  finally { store.close(); }
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Send workspace details as JSON." }, { status: 400 }); }
  if (!input || typeof input !== "object" || !("name" in input) || typeof input.name !== "string" || !("path" in input) || typeof input.path !== "string") {
    return Response.json({ error: "Enter a workspace name and directory." }, { status: 400 });
  }
  const { name, path } = input;
  try {
    return Response.json(withTaskStore(request, (store) => store.createWorkspace(name, path)), { status: 201 });
  } catch (error) {
    const invalid = error instanceof WorkspaceValidationError || error instanceof WorkspaceOwnershipError;
    return Response.json({ error: invalid ? error.message : "Could not create workspace." }, { status: invalid ? 400 : 500 });
  }
}
