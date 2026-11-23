import { withTaskStore } from "../../../../server/database.ts";
import { ColumnValidationError, PendingRunError, RunValidationError, WorkspaceOwnershipError } from "../../../../server/task-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    return Response.json(withTaskStore(request, (store) => store.reset(taskId)));
  } catch (error) {
    if (error instanceof PendingRunError)
      return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof RunValidationError || error instanceof ColumnValidationError || error instanceof WorkspaceOwnershipError)
      return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Could not reset the task. Reload the task and try again." }, { status: 500 });
  }
}
