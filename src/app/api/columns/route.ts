import { withTaskStore } from '@/server/database';
import { ColumnValidationError } from '@/server/task-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  try { return Response.json(withTaskStore(store => store.listColumns())); }
  catch { return Response.json({ error: 'Could not load columns. Try again.' }, { status: 500 }); }
}

async function update(request: Request, reorder: boolean) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: 'Send column settings as valid JSON.' }, { status: 400 }); }
  try {
    return Response.json(withTaskStore(store => reorder ? store.reorderColumns(input) : store.createColumn(input)));
  } catch (error) {
    if (error instanceof ColumnValidationError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: 'Could not save columns. Try again.' }, { status: 500 });
  }
}

export function POST(request: Request) { return update(request, false); }
export function PUT(request: Request) { return update(request, true); }
