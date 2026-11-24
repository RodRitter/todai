import { withTaskStore } from "../../../../server/database.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    if (typeof taskId !== "string") throw new Error("Choose a task.");
    const task = withTaskStore(request, (store) => {
      if (!store.readTask(taskId)) throw new Error("This task no longer exists.");
      store.cleanupWorktrees(taskId);
      return store.readTask(taskId)!;
    });
    if (task.worktree?.status === "error")
      return Response.json({ error: task.worktree.error }, { status: 409 });
    return Response.json(task);
  } catch {
    return Response.json({ error: "Could not retry worktree cleanup. Reload the task and try again." }, { status: 400 });
  }
}
