import { withTaskStore } from "@/server/database";
import { execution } from "@/server/execution";
import { CommentValidationError, WorkspaceOwnershipError } from "@/server/task-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { taskId, body, artifacts } = await request.json();
    const task = withTaskStore(request, (store) => store.postComment(taskId, body, artifacts));
    execution();
    return Response.json(task);
  } catch (error) {
    return Response.json({ error: error instanceof CommentValidationError || error instanceof WorkspaceOwnershipError ? error.message : "Could not post comment. Try again." },
      { status: error instanceof WorkspaceOwnershipError ? 403 : error instanceof CommentValidationError || error instanceof SyntaxError ? 400 : 500 });
  }
}
