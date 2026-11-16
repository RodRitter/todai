import { withTaskStore } from '@/server/database';
import { validateWorkspace, workspacePath, WorkspaceValidationError } from '@/server/workspace-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  try { return Response.json({ path: withTaskStore(workspacePath) }); }
  catch { return Response.json({ error: 'Could not load workspace settings.' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: 'Send a directory path as JSON.' }, { status: 400 }); }
  try {
    const path = validateWorkspace(input);
    withTaskStore(store => store.setWorkspacePath(path));
    return Response.json({ path });
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceValidationError ? error.message : 'Could not save workspace settings.' },
      { status: error instanceof WorkspaceValidationError ? 400 : 500 });
  }
}
