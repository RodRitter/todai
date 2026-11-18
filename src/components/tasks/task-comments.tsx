"use client";

import type { FeedbackDecision } from "@/domain/task";

import { ArtifactPicker, CommentAttachments, TaskArtifacts } from "@/components/artifacts/artifact-attachments";
import type { Artifact, ArtifactReference } from "@/domain/artifact";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Copy, LoaderCircle, Minus, Plus, Trash2 } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { RunHistory } from "./run-history";
import { toast } from "@/components/ui/toast";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import { isWorkflowHistoryComment, type AgentStatus, type TaskComment } from "@/domain/task";

export function TaskComments({ taskId, comments = [], onAnswerFeedback, onPostComment, onDeleteComment, agents = [], agentStatus }: {
  taskId?: string;
  comments?: TaskComment[];
  agentStatus?: AgentStatus;
  agents?: AgentProfile[];
  onDeleteComment?: (commentId: string) => Promise<void>;
  onPostComment?: (body: string, artifacts?: ArtifactReference[]) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string, decision?: FeedbackDecision) => Promise<void>;
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
      {taskId && tab === "comments" && <RunHistory key={taskId} taskId={taskId} />}
      <TaskActivity comments={comments} agentStatus={agentStatus} agents={agents} onPostComment={onPostComment} onDeleteComment={onDeleteComment} onAnswerFeedback={onAnswerFeedback} />
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

export function TaskActivity({ comments = [], agentStatus, agents = [], onPostComment, onDeleteComment, onAnswerFeedback, onNavigateFeedback, selectedCommentId }: {
  comments?: TaskComment[];
  agentStatus?: AgentStatus;
  agents?: AgentProfile[];
  onPostComment?: (body: string, artifacts?: ArtifactReference[]) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string, decision?: FeedbackDecision) => Promise<void>;
  onNavigateFeedback?: (commentId: string) => void;
  selectedCommentId?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(20);
  const ordered = [...comments].filter((comment) => !comments.some((request) => request.feedbackStatus && isFeedbackReply(comment, request)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const targetIndex = ordered.findIndex((comment) => comment.id === selectedCommentId || comments.some((reply) => reply.id === selectedCommentId && isFeedbackReply(reply, comment)));
  const count = Math.max(visibleCount, targetIndex + 1);
  if (count > visibleCount) setVisibleCount(count);
  return <section aria-label="Task discussion" className="space-y-6">
      {ordered.length > count && <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount(count + 20)}>Show older discussion ({ordered.length - count} remaining)</Button>}
      {onPostComment && <CommentInput agents={agents} onPost={onPostComment} agentStatus={agentStatus} />}
      {comments.length || agentStatus === "Running" ? (
        <ol className="space-y-8">
          {agentStatus === "Running" && (
            <li role="status" className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
              <span>The agent is working. Its handover will appear here.</span>
            </li>
          )}
          {ordered.slice(0, count)
            .map((comment) => (
              <li key={comment.id} id={`comment-${comment.id}`} tabIndex={-1} className="group/comment grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-b border-border/60 pb-6 last:border-0 last:pb-0">
                <div
                  className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  aria-hidden="true"
                >
                  {comment.authorName === "Human" ? (
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
                    {onDeleteComment && !isWorkflowHistoryComment(comment, comments) && <DeleteComment commentId={comment.id} onDelete={onDeleteComment} disabled={agentStatus === "Running" || agentStatus === "Queued" || comment.feedbackStatus === "pending"} />}
                  </div>
                  <div className={comment.feedbackStatus === "pending"
                    ? "col-span-2 min-w-0 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:col-start-2 sm:col-span-1"
                    : "col-span-2 min-w-0 space-y-3 sm:col-start-2 sm:col-span-1"}>
                    {comment.feedbackStatus && (
                      <p className="text-sm font-semibold">
                        {feedbackTitle(comment)}
                      </p>
                    )}
                    {comment.workflowExecutionId && <FeedbackOrigin comment={comment} />}
                    {comment.feedbackStatus ? <Markdown>{comment.body}</Markdown> : <CommentBody body={comment.body} />}
                    {!!comment.artifacts?.length && <CommentAttachments references={comment.artifacts} />}
                    {comment.recommendation && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Recommendation</p>
                        <Markdown>{comment.recommendation}</Markdown>
                      </div>
                    )}
                    {comment.feedbackStatus === "pending" && (
                      onNavigateFeedback ? <Button type="button" variant="outline" onClick={() => onNavigateFeedback(comment.id)}>Reply in Overview</Button> : <FeedbackInput commentId={comment.id} checkpoint={comment.feedbackKind === "checkpoint"} reviewLimit={comment.feedbackKind === "review-limit"} onAnswer={onAnswerFeedback} />
                    )}
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" aria-label="Copy comment" onClick={async () => {
                      try { await navigator.clipboard.writeText(comment.body); toast.success("Comment copied."); }
                      catch { toast.error("Could not copy comment."); }
                    }}><Copy aria-hidden="true" className="size-3.5" />Copy</Button>
                  </div>
                  {comment.feedbackStatus && comments.filter((reply) => isFeedbackReply(reply, comment)).map((reply) => (
                    <div key={reply.id} id={`comment-${reply.id}`} tabIndex={-1} className="col-span-2 ml-4 min-w-0 space-y-2 border-l-2 border-border pl-4 sm:ml-9 sm:pl-5">
                      <div className="flex items-center gap-3"><p className="text-sm font-semibold">Human</p>
                        {onDeleteComment && !isWorkflowHistoryComment(reply, comments) && <DeleteComment commentId={reply.id} onDelete={onDeleteComment} disabled={agentStatus === "Running" || agentStatus === "Queued"} />}
                      </div>
                      <time className="text-xs text-muted-foreground" dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString()}</time>
                      {reply.decision && <p className="text-sm font-semibold">{({ approve: "Approved", "changes-requested": "Changes requested", "additional-round": "Additional round allowed", stop: "Workflow stopped" })[reply.decision]}</p>}
                      <CommentBody body={reply.body} />
                      {!!reply.artifacts?.length && <CommentAttachments references={reply.artifacts} />}
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

  </section>;
}

export function TaskResult({ comment, onNavigate }: { comment: TaskComment; onNavigate: () => void }) {
  return <section aria-label="Latest result" className="space-y-3">
    <h3 className="text-sm font-semibold">Latest result</h3>
    <p className="text-xs text-muted-foreground">{comment.authorName || "Agent"} · <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></p>
    <Markdown>{comment.body}</Markdown>
    {!!comment.artifacts?.length && <CommentAttachments references={comment.artifacts} />}
    <Button type="button" variant="outline" size="sm" onClick={onNavigate}>View in Activity</Button>
  </section>;
}

function isFeedbackReply(reply: TaskComment, request: TaskComment) {
  return reply.responseTo ? reply.responseTo === request.id : reply.authorName === "Human" && Boolean(reply.runId) && reply.runId === request.runId;
}

function feedbackTitle(comment: TaskComment) {
  if (comment.feedbackKind === "review-limit") return comment.feedbackStatus === "pending" ? "Review limit reached" : `Review intervention · ${comment.feedbackStatus === "cancelled" ? "Stopped" : "Answered"}`;
  const label = comment.feedbackKind === "checkpoint" ? "Human approval" : "Feedback request";
  return comment.feedbackStatus === "pending" ? (comment.feedbackKind === "checkpoint" ? "Your approval is needed" : "Your feedback is needed") : `${label} · ${comment.feedbackStatus === "cancelled" ? "Cancelled" : "Answered"}`;
}

function FeedbackOrigin({ comment }: { comment: TaskComment }) {
  return <p className="text-xs text-muted-foreground break-all">Execution {comment.workflowExecutionId} · Step {comment.stepId}</p>;
}

export function TaskFeedback({ comment, comments = [], onAnswer, onNavigate }: {
  comment: TaskComment; comments?: TaskComment[];
  onAnswer?: (commentId: string, body: string, decision?: FeedbackDecision) => Promise<void>;
  onNavigate?: (commentId: string) => void;
}) {
  const evidence = comments.find((item) => item.id === comment.evidenceCommentId);
  const changes = comment.feedbackKind === "checkpoint" ? comments.filter((item) => item.workflowExecutionId === comment.workflowExecutionId && item.stepId === comment.stepId && item.decision === "changes-requested").at(-1) : undefined;
  return <section id={`feedback-request-${comment.id}`} tabIndex={-1} aria-label="Pending feedback" className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
    <h3 className="font-semibold">{feedbackTitle(comment)}</h3>
    <p className="text-xs text-muted-foreground">{comment.authorName || "Agent"} · <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></p>
    {comment.workflowExecutionId && <FeedbackOrigin comment={comment} />}
    <Markdown>{comment.body}</Markdown>
    {comment.recommendation && <div className="space-y-1"><h4 className="text-sm font-semibold">Recommendation</h4><Markdown>{comment.recommendation}</Markdown></div>}
    {!!comment.artifacts?.length && <CommentAttachments references={comment.artifacts} />}
    {evidence && <div className="space-y-2 rounded-lg border p-3"><h4 className="text-sm font-semibold">Review evidence</h4>
      <Markdown>{evidence.body}</Markdown>
      {!!evidence.artifacts?.length && <CommentAttachments references={evidence.artifacts} />}
      {onNavigate && <Button type="button" variant="outline" size="sm" onClick={() => onNavigate(evidence.id)}>View evidence in Activity</Button>}
    </div>}
    {changes && <div className="space-y-2"><h4 className="text-sm font-semibold">Changes requested by {changes.authorName}</h4><Markdown>{changes.body}</Markdown>
      <p className="text-sm text-muted-foreground">This checkpoint is still waiting. Resolve the requested changes before approving, or stop the workflow to revise it.</p>
      {onNavigate && <Button type="button" variant="outline" size="sm" onClick={() => onNavigate(changes.id)}>View response in Activity</Button>}
    </div>}
    <FeedbackInput commentId={comment.id} checkpoint={comment.feedbackKind === "checkpoint"} reviewLimit={comment.feedbackKind === "review-limit"} onAnswer={onAnswer} />
    {onNavigate && <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate(comment.id)}>View request in Activity</Button>}
  </section>;
}

function DeleteComment({ commentId, onDelete, disabled }: {
  commentId: string;
  onDelete: (commentId: string) => Promise<void>;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try { await onDelete(commentId); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete comment."); }
    finally { setBusy(false); }
  }
  return <div className="ml-auto">
    {confirming ? <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs">Delete comment?</span>
      <Button type="button" size="sm" variant="destructive" disabled={busy || disabled} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete"}</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setConfirming(false); setError(""); }}>Cancel</Button>
    </div> : <Button type="button" size="icon" variant="ghost" aria-label="Delete comment" title={disabled ? "Finish the agent run and resolve pending feedback before deleting." : "Delete comment"}
      disabled={disabled} onClick={() => setConfirming(true)}
      className="size-7 text-muted-foreground transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/comment:opacity-100 [@media(hover:hover)]:group-focus-within/comment:opacity-100 focus-visible:opacity-100 hover:text-destructive">
      <Trash2 className="size-3.5" />
    </Button>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
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


function FeedbackInput({ commentId, onAnswer, checkpoint = false, reviewLimit = false }: {
  checkpoint?: boolean;
  reviewLimit?: boolean;
  commentId: string;
  onAnswer?: (commentId: string, body: string, decision?: FeedbackDecision) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(decision?: FeedbackDecision) {
    if (!onAnswer || (!decision && !body.trim()) || busy) return;
    setBusy(true);
    setError("");
    try {
      if (decision) await onAnswer(commentId, body.trim() || (decision === "additional-round" ? "Allow one additional round" : decision === "stop" ? "Stop review loop" : "Approved"), decision);
      else await onAnswer(commentId, body.trim());
    }
    catch (error) { setError(error instanceof Error ? error.message : "Could not submit feedback."); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={`feedback-${commentId}`} className="text-sm font-medium">Your feedback</label>
      <Textarea id={`feedback-${commentId}`} value={body} disabled={busy}
        placeholder={checkpoint ? "Explain requested changes or add an approval note…" : "Share your feedback to continue…"}
        onChange={(event) => setBody(event.target.value)}
        aria-describedby={error ? `feedback-error-${commentId}` : undefined} />
      {error && <p id={`feedback-error-${commentId}`} role="alert" className="text-sm text-destructive">{error}</p>}
      {reviewLimit ? <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !onAnswer} onClick={() => void submit("additional-round")}>Allow one additional round</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || !onAnswer} onClick={() => void submit("stop")}>Stop workflow</Button>
      </div> : checkpoint ? <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !onAnswer} onClick={() => void submit("approve")}>{busy ? "Submitting…" : "Approve"}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || !body.trim() || !onAnswer} onClick={() => void submit("changes-requested")}>Request changes</Button>
      </div> : <Button type="button" size="sm" disabled={busy || !body.trim() || !onAnswer} onClick={() => void submit()}>
        {busy ? "Submitting…" : "Submit feedback"}
      </Button>}
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
      controlsOnFocus
      compact
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
