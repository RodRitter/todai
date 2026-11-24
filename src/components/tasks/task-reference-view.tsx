import type { Task } from "@/domain/task";
import { Markdown } from "@/components/ui/markdown";
import { ConversationMessageBody } from "@/components/conversation/conversation-message";
import { TraceDescription } from "@/components/ui/trace";

export function TaskReferenceView({ task, workspaceName }: { task: Task; workspaceName: string }) {
  return <main className="p-4 md:p-8">
    <article className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <TraceDescription>{workspaceName} · {task.archivedAt ? "Archived task" : task.status}</TraceDescription>
        <h1 className="text-lg font-medium">{task.title}</h1>
        <TraceDescription>Task ID: {task.id}</TraceDescription>
      </header>
      <Markdown>{task.description}</Markdown>
      <section aria-label="Task activity" className="space-y-4">
        {task.comments?.map((comment) => <article key={comment.id} id={`comment-${comment.id}`} className="space-y-2">
          <TraceDescription>{comment.authorName || "Agent"} · {comment.createdAt}</TraceDescription>
          <ConversationMessageBody message={comment} />
        </article>)}
      </section>
    </article>
  </main>;
}
