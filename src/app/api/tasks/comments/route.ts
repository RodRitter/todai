import { withTaskStore } from "@/server/database";
import { execution } from "@/server/execution";
import { CommentValidationError } from "@/server/task-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { taskId, body } = await request.json();
    const task = withTaskStore((store) => store.postComment(taskId, body));
    execution();
    return Response.json(task);
  } catch (error) {
    return Response.json({ error: error instanceof CommentValidationError ? error.message : "Could not post comment. Try again." },
      { status: error instanceof CommentValidationError || error instanceof SyntaxError ? 400 : 500 });
  }
}
