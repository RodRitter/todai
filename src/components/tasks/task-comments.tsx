"use client";
import { isHumanComment } from "@/domain/comment-author";


import { useBottomScroll } from "@/components/conversation/use-bottom-scroll";
import { ConversationComposer } from "@/components/conversation/conversation-composer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationEmptyState } from "@/components/ui/conversation-empty-state";
import { commentReference } from "@/domain/comment-reference";
import { ArtifactPicker } from "@/components/artifacts/artifact-attachments";
import type { Artifact, ArtifactReference } from "@/domain/artifact";
import { useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Copy, MessageCircle, Link, Ellipsis, LoaderCircle, Reply, Trash2 } from "lucide-react";
import { ConversationMessageBody } from "@/components/conversation/conversation-message";
import { useMessageDeletion } from "@/components/conversation/use-message-deletion";
import { MessageDisclosure, MessageThread, MessageReplyComposer, MessageAgentStatus } from "@/components/ui/message";
import { ConfirmationActions, ConfirmationStatus } from "@/components/ui/confirmation";
import { PromptSend } from "@/components/ui/prompt-send";
import { toast } from "@/components/ui/toast";
import { DescriptionEditor } from "./description-editor";
import type { AgentProfile } from "@/domain/column-agent";
import { groupActivity } from "@/domain/activity";
import type { AgentStatus, TaskComment } from "@/domain/task";

const emptyComments: TaskComment[] = [];

export function TaskComments({ taskId, active = true, onChat, embedded = false, comments = emptyComments, onAnswerFeedback, onPostComment, onDeleteComment, agents = [], agentStatus }: {
  taskId?: string;
  active?: boolean;
  onChat?: (comment: TaskComment) => void;
  embedded?: boolean;
  comments?: TaskComment[];
  agentStatus?: AgentStatus;
  agents?: AgentProfile[];
  onDeleteComment?: (commentId: string) => Promise<void>;
  onPostComment?: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>;
  onAnswerFeedback?: (commentId: string, body: string) => Promise<void>;
}) {
  const { viewport, content } = useBottomScroll(active && embedded);
  const [observed, setObserved] = useState({ taskId, comments, active });
  const [attentionId, setAttentionId] = useState<string>();
  if (observed.comments !== comments || observed.taskId !== taskId || observed.active !== active) {
    const previousIds = new Set(observed.comments.map((comment) => comment.id));
    const latest = active && observed.active && observed.taskId === taskId
      ? comments.filter((comment) => !previousIds.has(comment.id) && !isHumanComment(comment))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)
      : undefined;
    setObserved({ taskId, comments, active });
    if (latest || !active || observed.taskId !== taskId) setAttentionId(latest?.id);
  }
  const activity = <div ref={content} className={embedded ? "space-y-6 pb-4" : "space-y-6"}>
      {!comments.length && agentStatus !== "Running" && agentStatus !== "Queued" && <ConversationEmptyState variant="comments" />}
      {comments.length ? (
        <ol aria-label="Activity, oldest first" className="space-y-4">
          {groupActivity(comments).toReversed().map(({ message: comment, replies }) => (
            <li key={comment.id} tabIndex={-1} id={`comment-${comment.id}`} className="group">
              <ActivityMessage agents={agents} attentionId={attentionId} onChat={onChat} comment={comment} replies={replies} agentStatus={agentStatus} onDeleteComment={onDeleteComment} onAnswerFeedback={onAnswerFeedback} onPostComment={onPostComment} />
            </li>
          ))}
        </ol>
      ) : null}
      {(agentStatus === "Running" || agentStatus === "Queued") && (
        <MessageAgentStatus status={agentStatus} />
      )}
    </div>;
  return (
    <section aria-label="Task activity" className={embedded ? "flex min-h-0 flex-1 flex-col" : "mt-8 space-y-6"}>
      {embedded ? <ScrollArea fade="vertical" fadeSize="sm" className="min-h-0 flex-1" viewportProps={{ ref: viewport }}>{activity}</ScrollArea> : activity}
      {onPostComment && <ConversationComposer variant={embedded ? "fixed" : "inline"}>
        <CommentInput agents={agents} onPost={onPostComment} agentStatus={agentStatus} />
      </ConversationComposer>}
    </section>
  );
}

function ActivityMessage({ agents, attentionId, onChat, comment, replies = [], agentStatus, onDeleteComment, onAnswerFeedback, onPostComment, nested = false, label }: {
  nested?: boolean;
  label?: string;
  agents: AgentProfile[];
  onChat?: (comment: TaskComment) => void;
  attentionId?: string;
  comment: TaskComment;
  replies?: TaskComment[];
  agentStatus?: AgentStatus;
  onPostComment?: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>;
  onDeleteComment?: (id: string) => Promise<void>;
  onAnswerFeedback?: (id: string, body: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [threadOpen, setThreadOpen] = useState(true);
  const [observedAttention, setObservedAttention] = useState(attentionId);
  if (observedAttention !== attentionId) {
    setObservedAttention(attentionId);
    if (comment.id === attentionId || replies.some((reply) => reply.id === attentionId)) setThreadOpen(true);
  }
  const replyButton = useRef<HTMLButtonElement>(null);
  const replyInput = useRef<HTMLDivElement>(null);
  const disabled = agentStatus === "Running" || agentStatus === "Queued";
  const feedback = comment.feedbackStatus === "pending" ? <FeedbackInput responseType={comment.responseType} commentId={comment.id} onAnswer={onAnswerFeedback} /> : undefined;
  const actions = <>
    {onPostComment && <Button ref={replyButton} type="button" size="xs" variant="comment-header" disabled={disabled}
      aria-expanded={threadOpen} aria-controls={`comment-content-${comment.id}`} onClick={() => { setThreadOpen(true); setReplying(true); requestAnimationFrame(() => replyInput.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus()); }}><Reply aria-hidden="true" />Reply</Button>}
    {onChat && <Button type="button" size="xs" variant="comment-header" onClick={() => onChat(comment)}><MessageCircle aria-hidden="true" />Chat</Button>}
    <CommentActions comment={comment} replyCount={replies.length} onDelete={onDeleteComment} disabled={disabled} />
  </>;
  return (
    <MessageDisclosure nested={nested} open={threadOpen} onOpenChange={setThreadOpen}
      label={label || comment.authorName || "Agent"}
      createdAt={comment.createdAt} actions={actions}
      status={comment.feedbackStatus && <ConfirmationStatus state={comment.feedbackStatus} />} replyCount={replies.length}
      composer={(replies.length > 0 || replying) && onPostComment && <MessageReplyComposer ref={replyInput} connected={!nested && replies.length > 0}>
        <CommentInput variant="reply" id={`reply-${comment.id}`} agents={agents} agentStatus={agentStatus} autoFocus={replying}
          onPost={(body, artifacts) => onPostComment(body, artifacts, comment.id)}
          onSent={() => setReplying(false)}
          onCancel={replies.length ? undefined : () => { setReplying(false); replyButton.current?.focus(); }} />
      </MessageReplyComposer>}
      attention={attentionId === comment.id} id={nested ? `comment-${comment.id}` : undefined}>
      <div id={`comment-content-${comment.id}`}>
        <ConversationMessageBody message={comment} feedback={feedback} embedded />
      </div>
      {replies.length > 0 && <MessageThread gutter={!nested} id={`thread-${comment.id}`} aria-label="Reply thread">
        {groupActivity(replies).toReversed().map(({ message, replies: children }) => <ActivityMessage key={message.id} nested
          agents={agents} attentionId={attentionId} onChat={onChat} comment={message} replies={children} agentStatus={agentStatus}
          label={comment.feedbackStatus && message.runId === comment.runId && isHumanComment(message) ? "Your answer" : undefined}
          onDeleteComment={onDeleteComment} onAnswerFeedback={onAnswerFeedback} />)}
      </MessageThread>}

    </MessageDisclosure>
  );
}

function CommentActions({ comment, replyCount = 0, onDelete, disabled }: {
  comment: TaskComment;
  replyCount?: number;
  onDelete?: (commentId: string) => Promise<void>;
  disabled: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const deletion = useMessageDeletion<string>({ disabled, onDelete: async (id) => { await onDelete?.(id); } });
  async function copy(reference = false) {
    try { await navigator.clipboard.writeText(reference ? commentReference(comment) : comment.body); toast.success(reference ? "Comment reference copied." : "Message copied."); }
    catch { toast.error("Could not copy message."); }
  }
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={trigger} type="button" size="icon-xs" variant="comment-header" aria-label="Message actions" title="Message actions"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => { if (deletion.confirmation.open) event.preventDefault(); }}>
        <DropdownMenuItem onSelect={() => void copy()}><Copy aria-hidden="true" />Copy message</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy(true)}><Link aria-hidden="true" />Copy comment reference</DropdownMenuItem>
        {onDelete && <DropdownMenuItem variant="destructive" disabled={disabled || deletion.busy} onSelect={() => deletion.request(comment.id, trigger.current)}><Trash2 aria-hidden="true" />Delete message</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <DeleteConfirmation {...deletion.confirmation} title="Delete message?"
      description={`${replyCount ? `Delete this message and its ${replyCount} nested ${replyCount === 1 ? "reply" : "replies"}?` : "Delete this message?"} Artifacts linked only to the deleted messages will also be deleted. This cannot be undone.`}
      />
  </>;
}

function FeedbackInput({ commentId, responseType, onAnswer }: {
  responseType?: TaskComment["responseType"];
  commentId: string;
  onAnswer?: (commentId: string, body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(answer = body) {
    if (!onAnswer || !answer.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try { await onAnswer(commentId, responseType === "memory" && custom ? `Custom message:\n${answer.trim()}` : answer.trim()); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not submit feedback."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return (
    <div className="space-y-2">
      {(responseType !== "approval" && responseType !== "memory" || custom) && <>
        <label htmlFor={`feedback-${commentId}`} className="sr-only">Your feedback</label>
        <Textarea id={`feedback-${commentId}`} value={body} disabled={busy} autoFocus={custom}
          placeholder="Share your feedback to continue…"
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `feedback-error-${commentId}` : undefined} />
      </>}
      {error && <p id={`feedback-error-${commentId}`} role="alert" className="text-sm text-destructive">{error}</p>}
      <ConfirmationActions>{(responseType === "approval" || responseType === "memory") && !custom ? <>
        {responseType === "memory" && <Button type="button" size="sm" variant="outline" disabled={busy || !onAnswer} onClick={() => setCustom(true)}>Custom message</Button>}
        <Button type="button" size="sm" variant="outline" disabled={busy || !onAnswer} onClick={() => void submit("Rejected")}>Reject</Button>
        <Button type="button" size="sm" disabled={busy || !onAnswer} onClick={() => void submit("Approved")}>{busy ? "Submitting…" : "Approve"}</Button>
      </> : <>
        {responseType === "memory" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setCustom(false)}>Back</Button>}
        <Button type="button" size="sm" disabled={busy || !body.trim() || !onAnswer} onClick={() => void submit()}>
          {busy ? "Submitting…" : "Submit feedback"}
        </Button>
      </>}</ConfirmationActions>
    </div>
  );
}

function CommentInput({ agents, onPost, agentStatus, variant = "default", id = "task-comment", autoFocus = false, onSent, onCancel }: {
  agents: AgentProfile[];
  onPost: (body: string, artifacts?: ArtifactReference[], parentCommentId?: string) => Promise<void>;
  agentStatus?: AgentStatus;
  variant?: "default" | "reply";
  id?: string;
  autoFocus?: boolean;
  onSent?: () => void;
  onCancel?: () => void;
}) {
  const reply = variant === "reply";
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
      await onPost(body.trim(), attachments.map((artifact) => ({ artifactId: artifact.id })));
      setAttachments([]);
      setBody("");
      setVersion((value) => value + 1);
      onSent?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send message.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return (
    <DescriptionEditor
      key={version}
      id={id}
      label={reply ? "Your reply" : "Your message"}
      placeholder={reply ? "Reply" : "Send comment"}
      variant={reply ? "reply" : "prompt"}
      autoFocus={autoFocus}
      onSubmit={() => void submit()}
      compact
      value={body}
      onChange={setBody}
      disabled={busy || pendingRun}
      agents={agents}
      artifacts
      onArtifactSelect={(artifact) => setAttachments((items) => [...items.filter((item) => item.id !== artifact.id), artifact])}
      actions={
        <PromptSend size={reply ? "icon-xs" : "icon-sm"} disabled={busy || pendingRun || !body.trim()} onClick={() => void submit()} aria-label={reply ? busy ? "Sending reply" : "Send reply" : busy ? "Sending message" : "Send message"}>
          {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}
        </PromptSend>
      }
      toolbarActions={<ArtifactPicker compact={reply} attachmentIcon disabled={busy || pendingRun} onSelect={(artifact) => setAttachments((items) => [...items.filter((item) => item.id !== artifact.id), artifact])} />}
      footer={<>
        {onCancel && <Button type="button" size="sm" variant="ghost-muted" disabled={busy} onClick={onCancel}>Cancel</Button>}
        {attachments.map((artifact) => <div key={artifact.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{artifact.title}</span><Button type="button" size="sm" variant="ghost-muted" disabled={busy || pendingRun} onClick={() => setAttachments((items) => items.filter((item) => item.id !== artifact.id))}>Remove attachment</Button></div>)}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </>}
    />
  );
}
