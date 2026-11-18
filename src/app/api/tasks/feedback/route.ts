import { withTaskStore } from "../../../../server/database.ts";
import { execution } from "../../../../server/execution.ts";
import { FeedbackValidationError } from "../../../../server/task-store.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { taskId, commentId, body, decision } = await request.json();
    const task = withTaskStore(request, (store) => store.answerFeedback(taskId, commentId, body, decision));
    execution();
    return Response.json(task);
  } catch (error) {
    return Response.json({
      error: error instanceof FeedbackValidationError ? error.message : "Could not submit feedback. Try again.",
    }, { status: error instanceof FeedbackValidationError ? 409 : 400 });
  }
}
