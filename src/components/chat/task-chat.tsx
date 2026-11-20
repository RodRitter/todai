"use client";
import { useEffect, useRef, useState } from "react";
import { ConversationEmptyState } from "@/components/ui/conversation-empty-state";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Markdown } from "@/components/ui/markdown";
import { Message, MessageAvatar, MessageContent, MessageHeader, MessageAuthor, MessageAgentStatus, MessageBubbleRow } from "@/components/ui/message";
import { DescriptionEditor } from "@/components/tasks/description-editor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PromptSend } from "@/components/ui/prompt-send";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { ArrowUp, Trash2 } from "lucide-react";
import type { ChatMessage, ChatSession } from "@/domain/chat";
import type { AgentProfile } from "@/domain/column-agent";
import { CommentReferenceProvider } from "@/components/tasks/comment-reference";
import { chatRequest } from "./chat-client";

export function ChatConversation({ session, busy, onSend, onDelete, onClear, agents = [], body, onBodyChange, draftVersion = 0 }: {
  session: ChatSession; busy: boolean; onSend: (body: string) => Promise<void>; agents?: AgentProfile[];
  onDelete: (messageId: string) => Promise<void>; onClear: () => Promise<void>;
  body: string; onBodyChange: (body: string) => void; draftVersion?: number;
}) {
  const [deletion, setDeletion] = useState<{ messageId?: string; trigger: HTMLButtonElement } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const removing = useRef(false);
  const region = useRef<HTMLElement>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const [pending, setPending] = useState<{ message: ChatMessage; previousIds: Set<string> } | null>(null);
  const latestBody = useRef(body);
  useEffect(() => { latestBody.current = body; }, [body]);
  const accepted = pending && session.messages.some((message) =>
    !pending.previousIds.has(message.id) && message.authorName === "Human" && message.body === pending.message.body);
  const messages = pending && !accepted ? [...session.messages, pending.message] : session.messages;
  const agentStatus = session.running ? "Running" : pending && !accepted ? "Queued" : undefined;
  const locked = busy || session.running || deleting || pending !== null;
  async function submit() {
    if (locked || submitting.current || !body.trim()) return;
    submitting.current = true;
    setError("");
    setPending({ message: { id: crypto.randomUUID(), taskId: session.taskId, authorName: "Human", body: body.trim(), createdAt: new Date().toISOString() }, previousIds: new Set(session.messages.map((message) => message.id)) });
    latestBody.current = "";
    onBodyChange("");
    setVersion((value) => value + 1);
    try {
      await onSend(body.trim());
    } catch (error) {
      if (!latestBody.current) { onBodyChange(body); setVersion((value) => value + 1); }
      setError(error instanceof Error ? error.message : "Could not send the message.");
    }
    finally { submitting.current = false; setPending(null); }
  }
  async function remove() {
    if (!deletion || busy || session.running || removing.current) return;
    removing.current = true; setDeleting(true); setDeleteError("");
    try {
      if (deletion.messageId) await onDelete(deletion.messageId);
      else { await onClear(); setError(""); }
      setDeletion(null);
      requestAnimationFrame(() => region.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus());
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete chat messages."); }
    finally { removing.current = false; setDeleting(false); }
  }
  return <section ref={region} aria-label="Task chat" className="space-y-6">
    <DescriptionEditor key={`${draftVersion}:${version}`} id="task-chat-message" label="Your chat message" variant="prompt" compact
      autoFocus={draftVersion > 0} agents={agents} artifacts value={body} onChange={onBodyChange} disabled={locked}
      toolbarActions={(session.messages.length > 0 || session.error) ? <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost-muted" size="icon-xs" aria-label="Clear chat" disabled={locked}
            onClick={(event) => { setDeleteError(""); setDeletion({ trigger: event.currentTarget }); }}><Trash2 aria-hidden="true" /></Button>
        </TooltipTrigger>
        <TooltipContent>Clear chat</TooltipContent>
      </Tooltip> : undefined}
      onSubmit={() => void submit()} actions={<PromptSend disabled={locked || !body.trim()} aria-label="Send chat message" onClick={() => void submit()}><ArrowUp /></PromptSend>} />
    {agentStatus && <MessageAgentStatus status={agentStatus} />}
    {(error || session.error) && <p role="alert">{error || session.error}</p>}
    {!messages.length && !locked && !error && !session.error && <ConversationEmptyState variant="chat" />}
    {messages.length ? <ol aria-label="Chat messages, newest first" className="space-y-6">
      {[...messages].reverse().map((message) => {
        const personal = message.authorName === "Human";
        const deleteButton = <Button type="button" variant="ghost-destructive" size="icon-xs" reveal="hover" aria-label="Delete chat message" disabled={locked}
          onClick={(event) => { setDeleteError(""); setDeletion({ messageId: message.id, trigger: event.currentTarget }); }}><Trash2 aria-hidden="true" /></Button>;
        return <li key={message.id}>
          <Message className="group" align={personal ? "end" : "start"}>
            {!personal && <MessageAvatar name={message.authorName || "Agent"} />}
            <MessageContent>
              {personal ? <MessageBubbleRow>
                {deleteButton}
                <Bubble align="end" variant="muted"><BubbleContent><Markdown>{message.body}</Markdown></BubbleContent></Bubble>
              </MessageBubbleRow> : <>
                <MessageHeader><MessageAuthor createdAt={message.createdAt}>{message.authorName || "Agent"}</MessageAuthor>{deleteButton}</MessageHeader>
                <Markdown>{message.body}</Markdown>
              </>}
            </MessageContent>
          </Message>
        </li>;
      })}
    </ol> : null}
    <DeleteConfirmation open={deletion !== null} onOpenChange={(open) => {
      if (!open) { setDeletion(null); setDeleteError(""); deletion?.trigger.focus(); }
    }} title={deletion?.messageId ? "Delete chat message?" : "Clear chat?"}
      description={deletion?.messageId ? "Delete this message from the chat? This cannot be undone." : "Delete all messages from this task chat? This cannot be undone."}
      confirmLabel={deletion?.messageId ? "Delete" : "Clear chat"} busy={deleting} disabled={busy || session.running} error={deleteError} onConfirm={() => void remove()} />
  </section>;
}

export function TaskChat({ taskId, active, onNavigateComment, ...composer }: {
  taskId: string; active: boolean; onNavigateComment: (commentId: string) => void;
  agents?: AgentProfile[]; body: string; onBodyChange: (body: string) => void; draftVersion: number;
}) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const deleting = useRef(false);
  const generation = useRef(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let loading = false;
    async function load() {
      if (loading || deleting.current || document.hidden) return;
      loading = true;
      const requestGeneration = generation.current;
      try {
        const result = await chatRequest<ChatSession>(`?taskId=${encodeURIComponent(taskId)}`, undefined, controller.signal);
        if (!controller.signal.aborted && !deleting.current && requestGeneration === generation.current) { setSession(result); setError(""); }
      } catch (error) { if (!controller.signal.aborted && requestGeneration === generation.current) setError(error instanceof Error ? error.message : "Could not load chat."); }
      finally { loading = false; }
    }
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [taskId, active, retry]);
  async function mutate(input: { body: string } | { messageId: string } | { clear: true }, method: "POST" | "DELETE" = "POST") {
    if (sending.current) throw new Error("The chat is already processing a request.");
    sending.current = true; deleting.current = method === "DELETE"; generation.current++; setBusy(true);
    try { setSession(await chatRequest<ChatSession>("", { taskId, ...input }, undefined, method)); setError(""); }
    finally { generation.current++; sending.current = false; deleting.current = false; setBusy(false); }
  }
  return <CommentReferenceProvider taskId={taskId} onNavigate={onNavigateComment}>
    {error && <div role="alert">{error} <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry chat</Button></div>}
    {session ? <ChatConversation session={session} busy={busy} onSend={(body) => mutate({ body })} onDelete={(messageId) => mutate({ messageId }, "DELETE")} onClear={() => mutate({ clear: true }, "DELETE")} {...composer} /> : !error && <p role="status">Loading chat…</p>}
  </CommentReferenceProvider>;
}
