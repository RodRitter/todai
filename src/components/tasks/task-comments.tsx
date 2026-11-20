"use client";

import { ConversationEmptyState } from "@/components/ui/conversation-empty-state";
import { commentReference } from "@/domain/comment-reference";
import { ArtifactPicker } from "@/components/artifacts/artifact-attachments";
import type { Artifact, ArtifactReference } from "@/domain/artifact";
import { useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Copy, MessageCircle, Link, Ellipsis, LoaderCircle, Reply, Trash2 } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { Message, MessageContent, MessageHeader, MessageAvatar, MessageAuthor, MessageThread, MessageReply } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Confirmation, ConfirmationActions } from "@/components/ui/confirmation";
import { PromptSend } from "@/components/ui/prompt-send";
import { toast } from "@/components/ui/toast";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import { groupActivity } from "@/domain/activity";
import type { AgentStatus, TaskComment } from "@/domain/task";

export function TaskComments({ onChat, embedded = false, comments = [], onAnswerFeedback, onPostComment, onDeleteComment, agents = [], agentStatus }: {
  taskId?: string;
  onChat?: (comment: TaskComment) => void;
  embedded?: boolean;
  comments?: TaskComment[];
  agentStatus?: AgentStatus;
  agents?: AgentProfile[];
  onDeleteComment?: (commentId: string) => Promise<void>;
  onPostComment?: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string) => Promise<void>;
}) {
  return (
    <section aria-label="Task activity" className={embedded ? "space-y-6" : "mt-8 space-y-6"}>
      {onPostComment && <CommentInput agents={agents} onPost={onPostComment} agentStatus={agentStatus} />}
      {!comments.length && agentStatus !== "Running" && agentStatus !== "Queued" && <ConversationEmptyState variant="comments" />}
      {(agentStatus === "Running" || agentStatus === "Queued") && (
        <Message role="status"><MessageContent>
          <MessageHeader><LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none" />{agentStatus === "Queued" ? "The agent is queued to start." : "The agent is working…"}</MessageHeader>
        </MessageContent></Message>
      )}
      {comments.length ? (
        <ol aria-label="Activity, newest first" className="space-y-8">
          {groupActivity(comments).map(({ message: comment, replies }) => (
            <li key={comment.id} tabIndex={-1} id={`comment-${comment.id}`} className="group">
              <ActivityMessage onChat={onChat} comment={comment} replies={replies} agentStatus={agentStatus} onDeleteComment={onDeleteComment} onAnswerFeedback={onAnswerFeedback} onPostComment={onPostComment} />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ActivityMessage({ onChat, comment, replies = [], agentStatus, onDeleteComment, onAnswerFeedback, onPostComment }: {
  onChat?: (comment: TaskComment) => void;
  comment: TaskComment;
  replies?: TaskComment[];
  agentStatus?: AgentStatus;
  onPostComment?: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>;
  onDeleteComment?: (id: string) => Promise<void>;
  onAnswerFeedback?: (id: string, body: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [threadOpen, setThreadOpen] = useState(true);
  const replyButton = useRef<HTMLButtonElement>(null);
  const disabled = agentStatus === "Running" || agentStatus === "Queued";
  return (
    <Message>
      <MessageAvatar name={comment.authorName || "Agent"} />
      <MessageContent connected={replies.length > 0 || replying}>
        <MessageHeader><MessageAuthor>{comment.authorName || "Agent"}</MessageAuthor>
          <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>
            {new Date(comment.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </time>
          {onPostComment && <Button ref={replyButton} type="button" size="xs" variant="ghost-muted" disabled={disabled}
            aria-expanded={replying} aria-controls={`thread-${comment.id}`} onClick={() => { setThreadOpen(true); setReplying(true); }}><Reply aria-hidden="true" />Reply</Button>}
          {onChat && <Button type="button" size="xs" variant="ghost-muted" onClick={() => onChat(comment)}><MessageCircle aria-hidden="true" />Chat</Button>}
          <CommentActions comment={comment} replyCount={replies.length} onDelete={onDeleteComment} disabled={disabled} />
        </MessageHeader>
        {comment.feedbackStatus ? (
          <Confirmation state={comment.feedbackStatus} question={<Markdown>{comment.body}</Markdown>}
            recommendation={comment.recommendation && <Markdown>{comment.recommendation}</Markdown>}>
            {comment.feedbackStatus === "pending" && <FeedbackInput commentId={comment.id} onAnswer={onAnswerFeedback} />}

          </Confirmation>
        ) : (
          <Bubble variant="ghost">
            <BubbleContent><Markdown>{comment.body}</Markdown></BubbleContent>
          </Bubble>
        )}
        {(replies.length > 0 || replying) && <MessageThread id={`thread-${comment.id}`} aria-label="Reply thread" count={replies.length} open={threadOpen} onOpenChange={setThreadOpen}>
          {replies.map((reply) => <MessageReply key={reply.id} id={`comment-${reply.id}`} avatarName={reply.authorName || "Agent"} label={comment.feedbackStatus && reply.runId === comment.runId && reply.authorName === "Human" ? "Your answer" : reply.authorName || "Agent"}
            actions={<><time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
              <CommentActions comment={reply} onDelete={onDeleteComment} disabled={disabled} /></>}>
            <Markdown>{reply.body}</Markdown>
          </MessageReply>)}
          {replying && onPostComment && <ReplyInput commentId={comment.id} disabled={disabled}
            onPost={(body) => onPostComment(body, [], comment.id)}
            onClose={() => { setReplying(false); replyButton.current?.focus(); }} />}
        </MessageThread>}
      </MessageContent>
    </Message>
  );
}

function ReplyInput({ commentId, disabled, onPost, onClose }: {
  commentId: string; disabled: boolean; onPost: (body: string) => Promise<void>; onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!body.trim() || disabled || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try { await onPost(body.trim()); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not send reply."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="space-y-2">
    <Label htmlFor={`reply-${commentId}`} variant="metadata">Your reply</Label>
    <Textarea id={`reply-${commentId}`} autoFocus placeholder="Write a reply…" value={body}
      disabled={busy || disabled} onChange={(event) => setBody(event.target.value)}
      aria-invalid={!!error} aria-describedby={error ? `reply-error-${commentId}` : undefined} />
    {error && <p id={`reply-error-${commentId}`} role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" disabled={busy || disabled || !body.trim()} onClick={() => void submit()}>{busy ? "Sending…" : "Send reply"}</Button>
      <Button type="button" size="sm" variant="ghost-muted" disabled={busy} onClick={onClose}>Cancel</Button>
    </div>
  </div>;
}

function CommentActions({ comment, replyCount = 0, onDelete, disabled }: {
  comment: TaskComment;
  replyCount?: number;
  onDelete?: (commentId: string) => Promise<void>;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  async function remove() {
    if (!onDelete || busy || disabled) return;
    setBusy(true); setError("");
    try { await onDelete(comment.id); setConfirming(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete message."); }
    finally { setBusy(false); }
  }
  async function copy(reference = false) {
    try { await navigator.clipboard.writeText(reference ? commentReference(comment) : comment.body); toast.success(reference ? "Comment reference copied." : "Message copied."); }
    catch { toast.error("Could not copy message."); }
  }
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={trigger} type="button" size="icon-xs" variant="ghost-muted" aria-label="Message actions" title="Message actions"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => { if (confirming) event.preventDefault(); }}>
        <DropdownMenuItem onSelect={() => void copy()}><Copy aria-hidden="true" />Copy message</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy(true)}><Link aria-hidden="true" />Copy comment reference</DropdownMenuItem>
        {onDelete && <DropdownMenuItem variant="destructive" disabled={disabled || busy} onSelect={() => { setError(""); setConfirming(true); }}><Trash2 aria-hidden="true" />Delete message</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <DeleteConfirmation open={confirming} onOpenChange={(open) => {
      setConfirming(open);
      if (!open) { setError(""); trigger.current?.focus(); }
    }} title="Delete message?"
      description={replyCount ? `Delete this message and its ${replyCount} nested ${replyCount === 1 ? "reply" : "replies"}? This cannot be undone.` : "Delete this message? This cannot be undone."}
      busy={busy} disabled={disabled} error={error} onConfirm={() => void remove()} />
  </>;
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

function CommentInput({ agents, onPost, agentStatus }: { agents: AgentProfile[]; onPost: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>; agentStatus?: AgentStatus }) {
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
      onArtifactSelect={(artifact) => setAttachments((items) => [...items.filter((item) => item.id !== artifact.id), artifact])}
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
