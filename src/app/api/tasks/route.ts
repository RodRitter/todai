import { withTaskStore } from '@/server/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  try {
    return Response.json(withTaskStore(store => store.list()));
  } catch {
    return Response.json({ error: 'Could not load tasks. Check local database access and reload.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const input: unknown = await request.json();
    return Response.json(withTaskStore(store => store.save(input)));
  } catch {
    return Response.json({ error: 'Could not save task. Check task details and local database access, then try again.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'A task ID is required.' }, { status: 400 });
    withTaskStore(store => store.delete(id));
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: 'Could not delete task. Check local database access and try again.' }, { status: 500 });
  }
}
