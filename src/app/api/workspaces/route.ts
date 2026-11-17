import { WorkspaceSetupError } from "../../../domain/workspace-setup.ts";
import { openTaskStore } from "../../../server/database.ts";
import { WorkspaceOwnershipError, RunValidationError } from "../../../server/task-store.ts";
import { WorkspaceValidationError } from "../../../server/workspace-settings.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const store = openTaskStore();
  try { return Response.json(new URL(request.url).searchParams.get("archived") === "true" ? store.listArchivedWorkspaces() : store.listWorkspaces()); }
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
  const store = openTaskStore();
  try {
    return Response.json(store.createWorkspace(name, path, input), { status: 201 });
  } catch (error) {
    const invalid = error instanceof WorkspaceSetupError || error instanceof WorkspaceValidationError || error instanceof WorkspaceOwnershipError;
    return Response.json({ error: invalid ? error.message : "Could not create workspace." }, { status: invalid ? 400 : 500 });
  } finally { store.close(); }
}

export async function PATCH(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Send workspace details as JSON." }, { status: 400 }); }
  if (!input || typeof input !== "object" || !("id" in input) || typeof input.id !== "string" ||
      !("archived" in input) || typeof input.archived !== "boolean")
    return Response.json({ error: "Choose a workspace and archive or restore it." }, { status: 400 });
  const store = openTaskStore();
  try {
    store.setWorkspaceArchived(input.id, input.archived);
    return Response.json({ workspaces: store.listWorkspaces(), archived: store.listArchivedWorkspaces() });
  } catch (error) {
    const invalid = error instanceof RunValidationError || error instanceof WorkspaceOwnershipError;
    return Response.json({ error: invalid ? error.message : "Could not update workspace." }, { status: invalid ? 409 : 500 });
  } finally { store.close(); }
}
