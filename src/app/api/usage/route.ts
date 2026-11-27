import { withTaskStore } from "../../../server/database.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try { return Response.json(withTaskStore(request, store => ({ ...store.usage().trackedCredits(), creditLimit: store.getCreditLimit() }))); }
  catch { return Response.json({ error: "Could not load tracked credits." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  try {
    const input = await request.json();
    return Response.json(withTaskStore(request, store => ({ ...store.usage().setTrackedCredits(input?.action === "sync" ? store.usage().activeTaskCredits() : input?.credits), creditLimit: store.getCreditLimit() })));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not set tracked credits." }, { status: 400 });
  }
}
