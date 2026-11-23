import { withTaskStore } from "../../../server/database.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try { return Response.json(withTaskStore(request, store => store.usage().workspaceCredits())); }
  catch { return Response.json({ error: "Could not load tracked credits." }, { status: 400 }); }
}
