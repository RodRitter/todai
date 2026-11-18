import { execution } from "../../../server/execution.ts";
import { RunValidationError } from "../../../server/task-store.ts";
import { withTaskStore } from "../../../server/database.ts";
import { WorkflowValidationError } from "../../../server/workflow-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId");
    return Response.json(withTaskStore(request, (store) => taskId ? store.workflowHistory(taskId) : store.listWorkflows()));
  } catch {
    return Response.json({ error: "Could not load workflows for this workspace." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const input: unknown = await request.json();
    return Response.json(withTaskStore(request, (store) => store.saveWorkflow(input)));
  } catch (error) {
    return Response.json({ error: error instanceof WorkflowValidationError ? error.message : "Could not save this workflow." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { taskId, executionId } = await request.json();
    const task = withTaskStore(request, (store) => store.retryWorkflow(taskId, executionId));
    execution();
    return Response.json(task);
  } catch (error) {
    return Response.json({ error: error instanceof RunValidationError ? error.message : "Could not retry this workflow." }, { status: error instanceof RunValidationError ? 409 : 400 });
  }
}
