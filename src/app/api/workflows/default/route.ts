import { withTaskStore } from "../../../../server/database.ts";
import { WorkflowValidationError } from "../../../../server/workflow-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try { return Response.json(withTaskStore(request, (store) => store.getDefaultWorkflow())); }
  catch { return Response.json({ error: "Could not load the workspace default workflow." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  try {
    const { workflowId } = await request.json();
    return Response.json(withTaskStore(request, (store) => store.setDefaultWorkflow(workflowId)));
  } catch (error) {
    return Response.json({ error: error instanceof WorkflowValidationError ? error.message : "Could not save the workspace default workflow." }, { status: 400 });
  }
}
