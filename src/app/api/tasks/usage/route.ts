import { withTaskStore } from "../../../../server/database.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) return Response.json({ error: "A task ID is required." }, { status: 400 });
  try {
    return Response.json(withTaskStore(request, store => {
      const { trackingSince, totals, groups, models } = store.usage().read(taskId);
      return { trackingSince, totals, groups, models };
    }));
  }
  catch { return Response.json({ error: "Could not load task usage." }, { status: 400 }); }
}
