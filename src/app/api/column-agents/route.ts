import { withTaskStore } from "@/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    return Response.json(withTaskStore(request, (store) => store.listColumnAgents()));
  } catch {
    return Response.json(
      {
        error:
          "Could not load column agents. Check local database access and try again.",
      },
      { status: 500 },
    );
  }
}

export async function PUT() {
  return Response.json({ error: "Column assignments have been retired. Choose agents in a workflow." }, { status: 410 });
}
