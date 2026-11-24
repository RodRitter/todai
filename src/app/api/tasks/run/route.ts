import { withTaskStore } from "../../../../server/database.ts";
import { execution } from "../../../../server/execution.ts";
import { RunValidationError } from "../../../../server/task-store.ts";
import type { RunHistoryEntry } from "../../../../domain/execution.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) return Response.json({ error: "A task ID is required." }, { status: 400 });
  try {
    const history = withTaskStore(request, (store) => store.history(taskId)
      .filter((run) => run.kind !== "intent")
      .reverse()
      .map((run): RunHistoryEntry => ({
        id: run.id, agentId: run.profile.id, agentName: run.profile.name, status: run.status,
        createdAt: run.createdAt, startedAt: run.startedAt,
        finishedAt: run.finishedAt, summary: run.summary, activity: store.runActivity(run.id),
      })));
    return Response.json(history);
  } catch {
    return Response.json({ error: "Could not load run history." }, { status: 400 });
  }
}

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
