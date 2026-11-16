import { testExecutorTool } from "@/server/executor-tools";
import { AgentValidationError, parseExecutionTool } from "@/domain/column-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let active: Promise<{ message: string }> | undefined;

export async function POST(request: Request) {
  if (active)
    return Response.json(
      { error: "An executor test is already running. Wait for it to finish, then retry." },
      { status: 409 },
    );
  try {
    const tool = parseExecutionTool(new URL(request.url).searchParams.get("tool") ?? "codex");
    active = testExecutorTool(tool);
    return Response.json(await active);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Executor test failed unexpectedly. Check the app server logs and retry.",
      },
      { status: error instanceof AgentValidationError ? 400 : 500 },
    );
  } finally {
    active = undefined;
  }
}
