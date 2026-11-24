import { RunValidationError, WorkspaceOwnershipError } from "../../../server/task-store.ts";
import { withTaskStore } from "../../../server/database.ts";
import {
  validateWorkspace,
  workspacePath,
  WorkspaceValidationError,
} from "../../../server/workspace-settings.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    return Response.json(withTaskStore(request, (store) => ({ path: workspacePath(store), worktreesEnabled: store.getWorktreesEnabled() })));
  } catch {
    return Response.json(
      { error: "Could not load workspace settings." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { error: "Send a directory path as JSON." },
      { status: 400 },
    );
  }
  try {
    const path = validateWorkspace(input);
    withTaskStore(request, (store) => store.setWorkspacePath(path));
    return Response.json({ path });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof WorkspaceValidationError || error instanceof RunValidationError || error instanceof WorkspaceOwnershipError
            ? error.message
            : "Could not save workspace settings.",
      },
      { status: error instanceof RunValidationError || error instanceof WorkspaceOwnershipError ? 409 : error instanceof WorkspaceValidationError ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    const worktreesEnabled = withTaskStore(request, (store) => store.setWorktreesEnabled(input?.worktreesEnabled));
    return Response.json({ worktreesEnabled });
  } catch (error) {
    const known = error instanceof RunValidationError || error instanceof WorkspaceOwnershipError;
    return Response.json({ error: known ? error.message : "Could not save task worktree settings." },
      { status: known ? 409 : error instanceof SyntaxError ? 400 : 500 });
  }
}
