import { withTaskStore } from "../../../../server/database.ts";
import { execution } from "../../../../server/execution.ts";
import { CommentValidationError, WorkspaceOwnershipError } from "../../../../server/task-store.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { taskId, body, artifacts, parentCommentId } = await request.json();
    const task = withTaskStore(request, (store) => store.postComment(taskId, body, artifacts, parentCommentId));
    execution();
    return Response.json(task);
  } catch (error) {
    return Response.json({ error: error instanceof CommentValidationError || error instanceof WorkspaceOwnershipError ? error.message : "Could not post comment. Try again." },
      { status: error instanceof WorkspaceOwnershipError ? 403 : error instanceof CommentValidationError || error instanceof SyntaxError ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json();
    const task = withTaskStore(request, (store) => store.deleteComment(input?.taskId, input?.commentId));
    return Response.json(task);
  } catch (error) {
    return Response.json({ error: error instanceof CommentValidationError || error instanceof WorkspaceOwnershipError ? error.message : "Could not delete comment. Try again." },
      { status: error instanceof WorkspaceOwnershipError ? 403 : error instanceof CommentValidationError || error instanceof SyntaxError ? 400 : 500 });
  }
}
