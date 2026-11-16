import { Bot, MessageSquare } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import type { TaskComment } from "@/domain/task";

export function TaskComments({ comments = [] }: { comments?: TaskComment[] }) {
  return (
    <section aria-label="Comments" className="mt-8 space-y-5 border-t pt-6">
      <div className="flex items-center gap-2">
        <MessageSquare
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">Comments</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {comments.length}
        </span>
      </div>
      {comments.length ? (
        <ol className="space-y-6">
          {[...comments]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <div
                  className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                  aria-hidden="true"
                >
                  {comment.authorName ? (
                    comment.authorName
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase()
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold wrap-anywhere">
                      {comment.authorName || "Agent"}
                    </span>
                    <time
                      className="text-muted-foreground text-xs"
                      dateTime={comment.createdAt}
                      title={new Date(comment.createdAt).toLocaleString()}
                    >
                      {new Date(comment.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <CommentBody body={comment.body} />
                  </div>
                </div>
              </li>
            ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">No comments yet.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Agent updates and handovers will appear here.
          </p>
        </div>
      )}
    </section>
  );
}

function CommentBody({ body }: { body: string }) {
  const isLong = body.length > 600 || body.split("\n").length > 8;

  if (!isLong) return <Markdown>{body}</Markdown>;

  return (
    <div className="relative [&:has(details[open])>.comment-preview]:hidden [&:has(details[open])>.comment-fade]:hidden">
      <div
        aria-hidden="true"
        className="comment-fade pointer-events-none absolute -inset-x-4 -bottom-3 h-12 rounded-b-2xl bg-linear-to-b from-transparent to-foreground/5"
      />
      <div className="comment-preview mb-3 max-h-36 overflow-hidden">
        <Markdown compact>{body.split("\n").slice(0, 6).join("\n")}</Markdown>
      </div>
      <details className="group/comment relative">
        <summary className="w-fit cursor-pointer rounded-sm text-xs font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <span className="group-open/comment:hidden">Show full comment</span>
          <span className="hidden group-open/comment:inline">
            Collapse comment
          </span>
        </summary>
        <div className="mt-3">
          <Markdown>{body}</Markdown>
        </div>
      </details>
    </div>
  );
}
