"use client";

import { ArtifactPicker, TaskArtifacts } from "@/components/artifacts/artifact-attachments";
import type { Artifact, ArtifactReference } from "@/domain/artifact";
import { useRef, useState } from "react";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, Copy, LoaderCircle, Trash2 } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { Message, MessageContent, MessageHeader, MessageFooter, MessageReplies, MessageReply } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Confirmation, ConfirmationActions } from "@/components/ui/confirmation";
import { PromptSend } from "@/components/ui/prompt-send";
import { toast } from "@/components/ui/toast";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import { groupActivity } from "@/domain/activity";
import type { AgentStatus, TaskComment } from "@/domain/task";

export function TaskComments({ taskId, comments = [], onAnswerFeedback, onPostComment, onDeleteComment, agents = [], agentStatus }: {
  taskId?: string;
  comments?: TaskComment[];
  agentStatus?: AgentStatus;
  agents?: AgentProfile[];
  onDeleteComment?: (commentId: string) => Promise<void>;
  onPostComment?: (body: string, artifacts?: ArtifactReference[]) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string) => Promise<void>;
}) {
  const [tab, setTab] = useState("activity");
  const [artifactCount, setArtifactCount] = useState(0);
  return (
    <Tabs value={tab} onValueChange={setTab} asChild>
    <section aria-label="Task activity" className="mt-8 space-y-6">
      <TabsList aria-label="Task activity">
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="artifacts">Artifacts ({artifactCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="activity" forceMount className="space-y-6">
        {onPostComment && <CommentInput agents={agents} onPost={onPostComment} agentStatus={agentStatus} />}
        {agentStatus === "Running" && (
          <Message role="status"><MessageContent>
            <MessageHeader><LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none" />The agent is working…</MessageHeader>
          </MessageContent></Message>
        )}
        {comments.length ? (
          <ol aria-label="Activity, newest first" className="space-y-8">
            {groupActivity(comments).map(({ message: comment, replies }) => (
              <li key={comment.id} id={`comment-${comment.id}`} className="group">
                <ActivityMessage comment={comment} replies={replies} agentStatus={agentStatus} onDeleteComment={onDeleteComment} onAnswerFeedback={onAnswerFeedback} />
              </li>
            ))}
          </ol>
        ) : agentStatus !== "Running" && <Message><MessageContent><MessageHeader>No activity yet. Send a message to get started.</MessageHeader></MessageContent></Message>}
      </TabsContent>
      <TabsContent value="artifacts" forceMount>
        {taskId ? <TaskArtifacts onCountChange={setArtifactCount} taskId={taskId} commentsKey={JSON.stringify(comments.map((comment) => comment.id))} onNavigateComment={(commentId) => {
          setTab("activity");
          requestAnimationFrame(() => document.getElementById(`comment-${commentId}`)?.scrollIntoView({ block: "nearest" }));
        }} /> : <p className="text-sm text-muted-foreground">No linked artifacts yet.</p>}
      </TabsContent>
    </section>
    </Tabs>
  );
}

function ActivityMessage({ comment, replies = [], agentStatus, onDeleteComment, onAnswerFeedback }: {
  comment: TaskComment;
  replies?: TaskComment[];
  agentStatus?: AgentStatus;
  onDeleteComment?: (id: string) => Promise<void>;
  onAnswerFeedback?: (id: string, body: string) => Promise<void>;
}) {
  return (
    <Message align={comment.authorName === "Human" ? "end" : "start"}>
      <MessageContent>
        <MessageHeader>{comment.authorName || "Agent"}</MessageHeader>
        {comment.feedbackStatus ? (
          <Confirmation state={comment.feedbackStatus} question={<Markdown>{comment.body}</Markdown>}
            recommendation={comment.recommendation && <Markdown>{comment.recommendation}</Markdown>}>
            {comment.feedbackStatus === "pending" && <FeedbackInput commentId={comment.id} onAnswer={onAnswerFeedback} />}
            {!!replies.length && <MessageReplies variant="compact" aria-label="Feedback responses">
              {replies.map((reply) => <MessageReply key={reply.id} id={`comment-${reply.id}`} label="Your answer"
                actions={onDeleteComment && <DeleteComment commentId={reply.id} onDelete={onDeleteComment} disabled={agentStatus === "Running" || agentStatus === "Queued"} />}>
                <Markdown>{reply.body}</Markdown>
              </MessageReply>)}
            </MessageReplies>}
          </Confirmation>
        ) : (
          <Bubble align={comment.authorName === "Human" ? "end" : "start"} variant={comment.authorName === "Human" ? "muted" : "ghost"}>
            <BubbleContent><Markdown>{comment.body}</Markdown></BubbleContent>
          </Bubble>
        )}
        <MessageFooter className="gap-2">
          <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>
            {new Date(comment.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </time>
          <Button type="button" size="icon-xs" variant="ghost" aria-label="Copy message" title="Copy message" onClick={async () => {
            try { await navigator.clipboard.writeText(comment.body); toast.success("Message copied."); }
            catch { toast.error("Could not copy message."); }
          }}><Copy aria-hidden="true" /></Button>
          {onDeleteComment && <DeleteComment commentId={comment.id} replyCount={replies.length} onDelete={onDeleteComment} disabled={agentStatus === "Running" || agentStatus === "Queued" || comment.feedbackStatus === "pending"} />}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

function DeleteComment({ commentId, replyCount = 0, onDelete, disabled }: {
  replyCount?: number;
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
    try { await onDelete(commentId); setConfirming(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete message."); }
    finally { setBusy(false); }
  }
  return <div>
    <Button type="button" size="icon-xs" variant="ghost-destructive" aria-label="Delete message" title={disabled ? "Finish the agent run and resolve pending feedback before deleting." : "Delete message"}
      disabled={disabled || busy} onClick={() => { setError(""); setConfirming(true); }}
      reveal="hover">
      <Trash2 className="size-3.5" />
    </Button>
    <DeleteConfirmation
      open={confirming}
      onOpenChange={(open) => { setConfirming(open); if (!open) setError(""); }}
      title="Delete message?"
      description={replyCount ? `Delete this message and its ${replyCount} nested ${replyCount === 1 ? "reply" : "replies"}? This cannot be undone.` : "Delete this message? This cannot be undone."}
      busy={busy}
      disabled={disabled}
      error={error}
      onConfirm={() => void remove()}
    />
  </div>;
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
      <label htmlFor={`feedback-${commentId}`} className="sr-only">Your feedback</label>
      <Textarea id={`feedback-${commentId}`} value={body} disabled={busy}
        placeholder="Share your feedback to continue…"
        onChange={(event) => setBody(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `feedback-error-${commentId}` : undefined} />
      {error && <p id={`feedback-error-${commentId}`} role="alert" className="text-sm text-destructive">{error}</p>}
      <ConfirmationActions><Button type="button" size="sm" disabled={busy || !body.trim() || !onAnswer} onClick={() => void submit()}>
        {busy ? "Submitting…" : "Submit feedback"}
      </Button></ConfirmationActions>
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
      setError(error instanceof Error ? error.message : "Could not send message.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return (
    <DescriptionEditor
      key={version}
      id="task-comment"
      label="Your message"
      variant="prompt"
      onSubmit={() => void submit()}
      compact
      value={body}
      onChange={setBody}
      disabled={busy || pendingRun}
      agents={agents}
      artifacts
      actions={
        <PromptSend disabled={busy || pendingRun || !body.trim()} onClick={() => void submit()} aria-label={busy ? "Sending message" : "Send message"}>
          {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}
        </PromptSend>
      }
      toolbarActions={<ArtifactPicker attachmentIcon disabled={busy || pendingRun} onSelect={(artifact) => setAttachments((items) => [...items.filter((item) => item.id !== artifact.id), artifact])} />}
      footer={<>
        {attachments.map((artifact) => <div key={artifact.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{artifact.title} · Pinned revision {artifact.revisionNumber}</span><Button type="button" size="sm" variant="ghost-muted" disabled={busy || pendingRun} onClick={() => setAttachments((items) => items.filter((item) => item.id !== artifact.id))}>Remove attachment</Button></div>)}
        {pendingRun && <p role="status" className="text-xs">{agentStatus === "Running" ? "The agent is working." : "The agent is queued to start."} You can send a message when it finishes or asks for feedback.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </>}
    />
  );
}
