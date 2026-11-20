import { withTaskStore } from "../../../server/database.ts";
import { importJiraTicket } from "../../../server/jira-import.ts";
import { JiraImportValidationError, jiraTicketUrl } from "../../../domain/jira-import.ts";
import { executionWorkspace } from "../../../server/workspace-settings.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const active = new Set<string>();
export async function POST(request: Request) {
  let activeKey: string | undefined;
  try {
    const body = await request.json();
    const url = jiraTicketUrl(body?.url);
    const { agent, workspace, workspaceId } = withTaskStore(request, (store) => ({
      agent: store.listAgents().find((agent) => agent.id === body?.agentId), workspace: executionWorkspace(store), workspaceId: store.workspaceId,
    }));
    if (!agent) throw new JiraImportValidationError("Choose an agent in this workspace to read the ticket.");
    if (active.has(workspaceId)) return Response.json({ error: "A Jira import is already running in this workspace. Wait for it to finish." }, { status: 409 });
    active.add(workspaceId); activeKey = workspaceId;
    return Response.json(await importJiraTicket({ url, agent, workspace, signal: request.signal }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not import this Jira ticket." }, { status: error instanceof JiraImportValidationError || error instanceof SyntaxError ? 400 : 500 });
  } finally { if (activeKey) active.delete(activeKey); }
}
