import { withTaskStore } from "@/server/database";
import { execution } from "@/server/execution";
import { FeedbackValidationError } from "@/server/task-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { taskId, commentId, body } = await request.json();
    const task = withTaskStore((store) => store.answerFeedback(taskId, commentId, body));
    execution();
    return Response.json(task);
  } catch (error) {
    return Response.json({
      error: error instanceof FeedbackValidationError ? error.message : "Could not submit feedback. Try again.",
    }, { status: error instanceof FeedbackValidationError ? 409 : 400 });
  }
}
