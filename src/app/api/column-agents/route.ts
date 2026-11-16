import { withTaskStore } from '@/server/database';
import { AgentValidationError } from '@/components/tasks/column-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  try {
    return Response.json(withTaskStore(store => store.listColumnAgents()));
  } catch {
    return Response.json({ error: 'Could not load column agents. Check local database access and try again.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: 'Send column agent settings as valid JSON.' }, { status: 400 }); }
  try {
    return Response.json(withTaskStore(store => store.saveColumnAgent(input)));
  } catch (error) {
    if (error instanceof AgentValidationError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: 'Could not save column agent. Check local database access and try again.' }, { status: 500 });
  }
}
