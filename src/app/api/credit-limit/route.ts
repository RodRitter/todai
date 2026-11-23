import { withTaskStore } from "../../../server/database.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const input = await request.json();
    return Response.json(withTaskStore(request, store => ({ creditLimit: store.setCreditLimit(input?.creditLimit) })));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the credit limit." }, { status: 400 });
  }
}
