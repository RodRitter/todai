import { withTaskStore } from "../../../server/database.ts";
import { WorkspaceOwnershipError } from "../../../server/task-store.ts";
import { CleanupValidationError } from "../../../server/workspace-cleanup.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  const expected = error instanceof CleanupValidationError || error instanceof WorkspaceOwnershipError;
  return Response.json({ error: expected ? error.message : "Could not complete cleanup." }, { status: expected ? 409 : 500 });
}
export function GET(request: Request) {
  try {
    const days = Number(new URL(request.url).searchParams.get("retentionDays") ?? 90);
    return withTaskStore(request, store => Response.json(store.previewCleanup(days)));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  let input;
  try { input = await request.json(); } catch { return Response.json({ error: "Send the cleanup confirmation as JSON." }, { status: 400 }); }
  if (!input || typeof input !== "object" || typeof input.retentionDays !== "number" || typeof input.asOf !== "string" || typeof input.token !== "string")
    return Response.json({ error: "Preview cleanup before confirmation." }, { status: 400 });
  try { return withTaskStore(request, store => Response.json(store.executeCleanup(input))); }
  catch (error) { return failure(error); }
}
