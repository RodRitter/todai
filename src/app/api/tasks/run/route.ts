import { withTaskStore } from "@/server/database";
import { execution } from "@/server/execution";
import { RunValidationError } from "@/server/task-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    const task = withTaskStore(request, (store) => store.runTask(taskId));
    execution();
    return Response.json(task);
  } catch (error) {
    if (error instanceof RunValidationError)
      return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Could not start the agent. Reload the task and try again." }, { status: 400 });
  }
}
