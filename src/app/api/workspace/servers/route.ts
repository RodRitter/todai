import { withTaskStore } from "@/server/database";
import { workspacePath } from "@/server/workspace-settings";
import { detectWorkspaceServers, serverIdentity, stopWorkspaceServer } from "@/server/workspace-servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const workspace = withTaskStore(request, workspacePath);
    const servers = (await detectWorkspaceServers(workspace)).map((server) => ({ ...server, identity: serverIdentity(server.pid) }));
    return Response.json({ workspace, servers }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Could not detect workspace servers. Check that the workspace exists and lsof is available with permission to inspect processes." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  let input: unknown;
  try { input = await request.json(); } catch {
    return Response.json({ error: "Send a server PID and identity as JSON." }, { status: 400 });
  }
  const { pid, identity } = (input ?? {}) as { pid?: unknown; identity?: unknown };
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0 || typeof identity !== "string" || !identity.trim()) {
    return Response.json({ error: "A valid server PID and identity are required." }, { status: 400 });
  }
  try {
    await stopWorkspaceServer(withTaskStore(request, workspacePath), pid, identity);
    return Response.json({ stopped: true });
  } catch {
    return Response.json({ error: "Could not stop this server. It may have exited, changed, or be protected. Refresh and try again." }, { status: 409 });
  }
}
