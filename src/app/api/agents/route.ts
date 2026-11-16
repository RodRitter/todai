import { withTaskStore } from "@/server/database";
import { AgentValidationError } from "@/domain/column-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return Response.json(withTaskStore((store) => store.listAgents()));
  } catch {
    return Response.json(
      {
        error:
          "Could not load agents. Check local database access and try again.",
      },
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
      { error: "Send agent settings as valid JSON." },
      { status: 400 },
    );
  }
  try {
    return Response.json(withTaskStore((store) => store.saveAgent(input)));
  } catch (error) {
    if (error instanceof AgentValidationError)
      return Response.json({ error: error.message }, { status: 400 });
    return Response.json(
      {
        error:
          "Could not save agent. Check local database access and try again.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return Response.json(
      { error: "An agent ID is required." },
      { status: 400 },
    );
  try {
    withTaskStore((store) => store.deleteAgent(id));
    return new Response(null, { status: 204 });
  } catch {
    return Response.json(
      {
        error:
          "Could not delete agent. Check local database access and try again.",
      },
      { status: 500 },
    );
  }
}
