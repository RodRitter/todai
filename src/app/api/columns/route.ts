import { withTaskStore } from "@/server/database";
import { ColumnValidationError, type TaskStore } from "@/server/task-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    return Response.json(withTaskStore(request, (store) => store.listColumns()));
  } catch {
    return Response.json(
      { error: "Could not load columns. Try again." },
      { status: 500 },
    );
  }
}

async function update(
  request: Request,
  operation: (store: TaskStore, input: unknown) => string[],
) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { error: "Send column settings as valid JSON." },
      { status: 400 },
    );
  }
  try {
    return Response.json(withTaskStore(request, (store) => operation(store, input)));
  } catch (error) {
    if (error instanceof ColumnValidationError)
      return Response.json({ error: error.message }, { status: 400 });
    return Response.json(
      { error: "Could not save columns. Try again." },
      { status: 500 },
    );
  }
}

export function POST(request: Request) {
  return update(request, (store, input) => store.createColumn(input));
}
export function PUT(request: Request) {
  return update(request, (store, input) => store.reorderColumns(input));
}

export function PATCH(request: Request) {
  return update(request, (store, input) => {
    if (
      !input ||
      typeof input !== "object" ||
      !("column" in input) ||
      !("name" in input)
    ) {
      throw new ColumnValidationError(
        "Choose a column and enter its new name.",
      );
    }
    return store.renameColumn(input.column, input.name);
  });
}
export function DELETE(request: Request) {
  return update(request, (store, input) => store.deleteColumn(input));
}
