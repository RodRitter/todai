import { CreditValidationError, parseCredits } from "../../../domain/credit-settings.ts";
import { openTaskStore } from "../../../server/database.ts";
import { UserNameValidationError } from "../../../domain/user-name.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const store = openTaskStore();
  try { return Response.json({ userName: store.getUserName(), creditLimit: store.getCreditLimit() }); }
  finally { store.close(); }
}

export async function PUT(request: Request) {
  const store = openTaskStore();
  try {
    const input = await request.json();
    const limit = input?.creditLimit === undefined ? store.getCreditLimit() : parseCredits(input.creditLimit);
    const userName = input?.userName === undefined ? store.getUserName() : store.setUserName(input.userName);
    return Response.json({ userName, creditLimit: store.setCreditLimit(limit) });
  } catch (error) {
    const invalid = error instanceof CreditValidationError || error instanceof UserNameValidationError || error instanceof SyntaxError;
    return Response.json({ error: invalid ? error.message : "Could not save your name." }, { status: invalid ? 400 : 500 });
  } finally { store.close(); }
}
