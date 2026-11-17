import { execution } from "../../../server/execution.ts";
import { openTaskStore } from "../../../server/database.ts";
import { RunValidationError } from "../../../server/task-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Execution is global; the selected workspace must not redirect these controls.
export function GET() {
  const store = openTaskStore();
  try { return Response.json(store.executionState()); }
  finally { store.close(); }
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Send an execution action as JSON." }, { status: 400 }); }
  if (!input || typeof input !== "object" || !("action" in input) ||
      (input.action !== "resume" && input.action !== "stop" && input.action !== "pause") ||
      (input.action === "stop" && (!("runId" in input) || typeof input.runId !== "string" || !input.runId))) {
    return Response.json({ error: "Choose pause, resume, or stop with the active run ID." }, { status: 400 });
  }
  const store = openTaskStore();
  try {
    if (input.action === "resume") {
      store.resumeExecution("directoryChanges" in input ? input.directoryChanges : undefined);
    } else if (input.action === "pause") store.pauseExecution();
    else if ("runId" in input && typeof input.runId === "string") store.stopExecution(input.runId);
    execution();
    return Response.json(store.executionState());
  } catch (error) {
    return Response.json({ error: error instanceof RunValidationError ? error.message : "Could not update execution." },
      { status: error instanceof RunValidationError ? 409 : 500 });
  } finally { store.close(); }
}
