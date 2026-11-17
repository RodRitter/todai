import { withTaskStore } from "../../../../server/database.ts";
import { execution } from "../../../../server/execution.ts";
import { RunValidationError } from "../../../../server/task-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    const task = withTaskStore(request, (store) => store.stopTask(taskId));
    execution();
    return Response.json(task);
  } catch (error) {
    if (error instanceof RunValidationError)
      return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Could not stop this task. Reload the task and try again." }, { status: 400 });
  }
}
