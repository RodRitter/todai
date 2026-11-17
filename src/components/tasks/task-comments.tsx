"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, MessageSquare } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import type { TaskComment } from "@/domain/task";

export function TaskComments({ comments = [], onAnswerFeedback, onPostComment, agents = [] }: {
  comments?: TaskComment[];
  agents?: AgentProfile[];
  onPostComment?: (body: string) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string) => Promise<void>;
}) {
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
      {onPostComment && <CommentInput agents={agents} onPost={onPostComment} />}
      {comments.length ? (
        <ol className="space-y-6">
          {[...comments]
            .filter((comment) => !(comment.authorName === "Human" && comment.runId && comments.some((request) => request.runId === comment.runId && request.feedbackStatus)))
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
                  <div className={comment.feedbackStatus === "pending"
                    ? "space-y-3 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-4"
                    : "space-y-3 bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3"}>
                    {comment.feedbackStatus && (
                      <p className="text-sm font-semibold">
                        {comment.feedbackStatus === "pending" ? "Your feedback is needed" : comment.feedbackStatus === "cancelled" ? "Feedback request · Cancelled" : "Feedback request · Answered"}
                      </p>
                    )}
                    {comment.feedbackStatus ? <Markdown>{comment.body}</Markdown> : <CommentBody body={comment.body} />}
                    {comment.recommendation && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Recommendation</p>
                        <Markdown>{comment.recommendation}</Markdown>
                      </div>
                    )}
                    {comment.feedbackStatus === "pending" && (
                      <FeedbackInput commentId={comment.id} onAnswer={onAnswerFeedback} />
                    )}
                  </div>
                  {comment.feedbackStatus === "answered" && comments.filter((reply) => reply.authorName === "Human" && reply.runId === comment.runId).map((reply) => (
                    <div key={reply.id} className="space-y-2 rounded-xl border px-4 py-3">
                      <p className="text-sm font-semibold">Human</p>
                      <time className="text-xs text-muted-foreground" dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString()}</time>
                      <CommentBody body={reply.body} />
                    </div>
                  ))}
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


function FeedbackInput({ commentId, onAnswer }: {
  commentId: string;
  onAnswer?: (commentId: string, body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!onAnswer || !body.trim() || busy) return;
    setBusy(true);
    setError("");
    try { await onAnswer(commentId, body.trim()); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not submit feedback."); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={`feedback-${commentId}`} className="text-sm font-medium">Your feedback</label>
      <Textarea id={`feedback-${commentId}`} value={body} disabled={busy}
        placeholder="Share your feedback to continue…"
        onChange={(event) => setBody(event.target.value)}
        aria-describedby={error ? `feedback-error-${commentId}` : undefined} />
      {error && <p id={`feedback-error-${commentId}`} role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" size="sm" disabled={busy || !body.trim() || !onAnswer} onClick={() => void submit()}>
        {busy ? "Submitting…" : "Submit feedback"}
      </Button>
    </div>
  );
}

function CommentInput({ agents, onPost }: { agents: AgentProfile[]; onPost: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!body.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onPost(body.trim());
      setBody("");
      setVersion((value) => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not post comment.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return <div className="space-y-2">
    <label htmlFor="task-comment" className="text-sm font-medium">Your comment</label>
    <DescriptionEditor key={version} id="task-comment" label="Your comment" value={body} onChange={setBody} disabled={busy} agents={agents} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" size="sm" disabled={busy || !body.trim()} onClick={() => void submit()}>
      {busy ? "Posting…" : "Post comment"}
    </Button>
  </div>;
}
