import { withTaskStore } from "@/server/database";
import { inspectExecutors } from "@/server/executor-tools";
import { AgentValidationError } from "@/domain/column-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const defaultExecutor = withTaskStore((store) => store.getDefaultExecutor());
    const statuses = new URL(request.url).searchParams.get("status") === "true" ? await inspectExecutors() : undefined;
    return Response.json({ defaultExecutor, statuses });
  } catch { return Response.json({ error: "Could not load executor settings." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const defaultExecutor = withTaskStore((store) => store.setDefaultExecutor(body?.defaultExecutor));
    return Response.json({ defaultExecutor });
  } catch (error) {
    return Response.json({ error: error instanceof AgentValidationError ? error.message : "Could not save executor settings." },
      { status: error instanceof AgentValidationError || error instanceof SyntaxError ? 400 : 500 });
  }
}
