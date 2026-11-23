import { openTaskStore } from "../../../server/database.ts";
import { UserNameValidationError } from "../../../domain/user-name.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const store = openTaskStore();
  try { return Response.json({ userName: store.getUserName() }); }
  finally { store.close(); }
}

export async function PUT(request: Request) {
  const store = openTaskStore();
  try {
    const input = await request.json();
    return Response.json({ userName: store.setUserName(input?.userName) });
  } catch (error) {
    const invalid = error instanceof UserNameValidationError || error instanceof SyntaxError;
    return Response.json({ error: invalid ? error.message : "Could not save your name." }, { status: invalid ? 400 : 500 });
  } finally { store.close(); }
}
