"use client";

import { ArtifactPicker, CommentAttachments, TaskArtifacts } from "@/components/artifacts/artifact-attachments";
import type { Artifact, ArtifactReference } from "@/domain/artifact";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Minus, Plus } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import type { AgentStatus, TaskComment } from "@/domain/task";

export function TaskComments({ taskId, comments = [], onAnswerFeedback, onPostComment, agents = [], agentStatus }: {
  taskId?: string;
  comments?: TaskComment[];
  agentStatus?: AgentStatus;
  agents?: AgentProfile[];
  onPostComment?: (body: string, artifacts?: ArtifactReference[]) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string) => Promise<void>;
}) {
  const [tab, setTab] = useState("comments");
  const [artifactCount, setArtifactCount] = useState(0);
  return (
    <Tabs value={tab} onValueChange={setTab} asChild>
    <section aria-label="Task discussion" className="mt-8 space-y-6">
      <TabsList aria-label="Task discussion" className="flex h-auto justify-start gap-6 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="comments" className="-mb-px gap-2.5 rounded-none border-b-2 border-transparent px-0 pt-0 pb-3 font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
          Comments
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {comments.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="artifacts" className="-mb-px gap-2.5 rounded-none border-b-2 border-transparent px-0 pt-0 pb-3 font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
          Artifacts
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {artifactCount}
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="comments" forceMount className="space-y-6">
      {onPostComment && <CommentInput agents={agents} onPost={onPostComment} agentStatus={agentStatus} />}
      {comments.length || agentStatus === "Running" ? (
        <ol className="space-y-8">
          {agentStatus === "Running" && (
            <li className="flex gap-3">
              <div aria-hidden="true" className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full border">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex min-h-9 items-center gap-3">
                  <span className="text-sm font-semibold">Agent</span>
                  <span className="text-xs text-muted-foreground">Working…</span>
                </div>
                <div role="status" className="bg-primary/10 ring-primary/15 w-fit rounded-2xl rounded-tl-sm px-4 py-4 ring-1 ring-inset">
                  <span className="sr-only">The agent is working. Its comment will appear here.</span>
                  <span aria-hidden="true" className="flex h-3 items-center gap-1.5 text-primary">
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${dot * 200}ms`, animationDuration: "1.2s" }} />
                    ))}
                  </span>
                </div>
              </div>
            </li>
          )}
          {[...comments]
            .filter((comment) => !(comment.authorName === "Human" && comment.runId && comments.some((request) => request.runId === comment.runId && request.feedbackStatus)))
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .map((comment) => (
              <li key={comment.id} id={`comment-${comment.id}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3">
                <div
                  className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
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
                <div className="contents">
                  <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold wrap-anywhere">
                      {comment.authorName || "Agent"}
                    </span>
                    <time
                      className="text-muted-foreground inline-flex items-center gap-3 text-xs before:size-1 before:rounded-full before:bg-border"
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
                    ? "col-span-2 min-w-0 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
                    : "col-span-2 min-w-0 space-y-3 text-muted-foreground"}>
                    {comment.feedbackStatus && (
                      <p className="text-sm font-semibold">
                        {comment.feedbackStatus === "pending" ? "Your feedback is needed" : comment.feedbackStatus === "cancelled" ? "Feedback request · Cancelled" : "Feedback request · Answered"}
                      </p>
                    )}
                    {comment.feedbackStatus ? <Markdown>{comment.body}</Markdown> : <CommentBody body={comment.body} />}
                    {!!comment.artifacts?.length && <CommentAttachments references={comment.artifacts} />}
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
                    <div key={reply.id} className="col-span-2 ml-4 min-w-0 space-y-2 border-l-2 border-border pl-4 sm:ml-9 sm:pl-5">
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
        <div className="rounded-xl bg-muted/40 px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">No comments yet.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Agent updates and handovers will appear here.
          </p>
        </div>
      )}
      </TabsContent>
      <TabsContent value="artifacts" forceMount>
        {taskId ? <TaskArtifacts onCountChange={setArtifactCount} taskId={taskId} commentsKey={JSON.stringify(comments.map((comment) => comment.id))} onNavigateComment={(commentId) => {
          setTab("comments");
          requestAnimationFrame(() => document.getElementById(`comment-${commentId}`)?.scrollIntoView({ block: "nearest" }));
        }} /> : <p className="text-sm text-muted-foreground">No linked artifacts yet.</p>}
      </TabsContent>
    </section>
    </Tabs>
  );
}

function CommentBody({ body }: { body: string }) {
  const isLong = body.length > 600 || body.split("\n").length > 10;

  if (!isLong) return <Markdown>{body}</Markdown>;

  return <ExpandableComment body={body} />;
}

function ExpandableComment({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>();
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = useId();

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setContentHeight(content.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div
        id={contentId}
        className="relative overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ height: expanded ? contentHeight : Math.min(contentHeight ?? 240, 240) }}
      >
        <div ref={contentRef} className="flow-root" inert={!expanded}>
          <Markdown>{body}</Markdown>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-background transition-opacity duration-300 motion-reduce:transition-none ${expanded ? "opacity-0" : "opacity-100"}`}
        />
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-xs font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {expanded ? <Minus aria-hidden="true" className="size-3.5" /> : <Plus aria-hidden="true" className="size-3.5" />}
        {expanded ? "Show Less" : "Show More"}
      </button>
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

function CommentInput({ agents, onPost, agentStatus }: { agents: AgentProfile[]; onPost: (body: string, artifacts?: ArtifactReference[]) => Promise<void>; agentStatus?: AgentStatus }) {
  const [attachments, setAttachments] = useState<Artifact[]>([]);
  const pendingRun = agentStatus === "Running" || agentStatus === "Queued";
  const [body, setBody] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!body.trim() || submitting.current || pendingRun) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onPost(body.trim(), attachments.map((artifact) => ({ artifactId: artifact.id, revisionId: artifact.revisionId })));
      setAttachments([]);
      setBody("");
      setVersion((value) => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not post comment.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return (
    <DescriptionEditor
      key={version}
      id="task-comment"
      label="Your comment"
      value={body}
      onChange={setBody}
      disabled={busy || pendingRun}
      agents={agents}
      artifacts
      actions={
        <Button type="button" size="sm" className="rounded-lg px-4" disabled={busy || pendingRun || !body.trim()} onClick={() => void submit()}>
          {busy ? "Posting…" : "Post comment"}
        </Button>
      }
      toolbarActions={<ArtifactPicker attachmentIcon disabled={busy || pendingRun} onSelect={(artifact) => setAttachments((items) => [...items.filter((item) => item.id !== artifact.id), artifact])} />}
      footer={<>
        {attachments.map((artifact) => <div key={artifact.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{artifact.title} · Pinned revision {artifact.revisionNumber}</span><Button type="button" size="sm" variant="ghost" disabled={busy || pendingRun} onClick={() => setAttachments((items) => items.filter((item) => item.id !== artifact.id))}>Remove attachment</Button></div>)}
        {pendingRun && <p role="status" className="text-xs text-muted-foreground">{agentStatus === "Running" ? "The agent is working." : "The agent is queued to start."} You can comment when it finishes or asks for feedback.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </>}
    />
  );
}
