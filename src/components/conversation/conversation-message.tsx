"use client";

import type { ReactNode } from "react";
import type { TaskComment } from "@/domain/task";
import { Markdown } from "@/components/ui/markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageHeader, MessageAuthor, MessageBubbleRow } from "@/components/ui/message";
import { Confirmation } from "@/components/ui/confirmation";

export function ConversationMessageBody({ message, feedback }: { message: TaskComment; feedback?: ReactNode }) {
  return message.feedbackStatus ? <Confirmation state={message.feedbackStatus} question={<Markdown>{message.body}</Markdown>}
    recommendation={message.recommendation && <Markdown>{message.recommendation}</Markdown>}>
    {feedback}
  </Confirmation> : <Markdown>{message.body}</Markdown>;
}

// Presentation changes belong here. Thread structure and chat optimism remain with their callers.
export function ConversationMessage({ message, variant, actions, feedback, attention = false }: {
  message: TaskComment;
  variant: "chat" | "comment";
  actions?: ReactNode;
  feedback?: ReactNode;
  attention?: boolean;
}) {
  const personal = variant === "chat" && message.authorName === "Human";
  const body = <ConversationMessageBody message={message} feedback={feedback} />;
  return <Message className="group" attention={attention} align={personal ? "end" : "start"}>
    {!personal && <MessageAvatar name={message.authorName || "Agent"} />}
    <MessageContent>
      {personal ? <MessageBubbleRow>{actions}<Bubble align="end" variant="muted"><BubbleContent>{body}</BubbleContent></Bubble></MessageBubbleRow> : <>
        <MessageHeader><MessageAuthor createdAt={message.createdAt}>{message.authorName || "Agent"}</MessageAuthor>{actions}</MessageHeader>
        {variant === "comment" && !message.feedbackStatus ? <Bubble variant="ghost"><BubbleContent>{body}</BubbleContent></Bubble> : body}
      </>}
    </MessageContent>
  </Message>;
}
