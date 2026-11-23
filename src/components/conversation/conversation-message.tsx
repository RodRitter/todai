"use client";
import { isHumanComment } from "@/domain/comment-author";


import { useState, type ReactNode } from "react";
import type { TaskComment } from "@/domain/task";
import { Markdown } from "@/components/ui/markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageHeader, MessageAuthor, MessageBubbleRow, MessageDisclosure } from "@/components/ui/message";
import { Confirmation, ConfirmationStatus } from "@/components/ui/confirmation";

export function ConversationMessageBody({ message, feedback, embedded = false }: { message: TaskComment; feedback?: ReactNode; embedded?: boolean }) {
  return message.feedbackStatus ? <Confirmation layout={embedded ? "embedded" : "default"} state={message.feedbackStatus} statusPlacement={embedded ? "header" : "body"} question={<Markdown>{message.body}</Markdown>}
    recommendation={message.recommendation && <Markdown>{message.recommendation}</Markdown>}>
    {feedback}
  </Confirmation> : <Markdown>{message.body}</Markdown>;
}

// Presentation changes belong here. Thread structure and chat optimism remain with their callers.
export function ConversationMessage({ message, variant, actions, feedback, attention = false, connected = false }: {
  message: TaskComment;
  variant: "chat" | "comment";
  actions?: ReactNode;
  feedback?: ReactNode;
  attention?: boolean;
  connected?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const personal = variant === "chat" && isHumanComment(message);
  const body = <ConversationMessageBody message={message} feedback={feedback} embedded={variant === "comment"} />;
  if (variant === "comment") return <MessageDisclosure open={open} onOpenChange={setOpen}
    label={message.authorName || "Agent"} createdAt={message.createdAt} actions={actions}
    status={message.feedbackStatus && <ConfirmationStatus state={message.feedbackStatus} />} replyCount={0} attention={attention}>
    {body}
  </MessageDisclosure>;
  return <Message className="group" attention={attention} align={personal ? "end" : "start"}>
    {variant === "chat" && !personal && <MessageAvatar name={message.authorName || "Agent"} />}
    <MessageContent connected={connected}>
      {personal ? <MessageBubbleRow>{actions}<Bubble align="end" variant="muted"><BubbleContent>{body}</BubbleContent></Bubble></MessageBubbleRow> : <>
        <MessageHeader><MessageAuthor createdAt={message.createdAt}>{message.authorName || "Agent"}</MessageAuthor>{actions}</MessageHeader>
        {body}
      </>}
    </MessageContent>
  </Message>;
}
