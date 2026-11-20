"use client";
import { createContext, useContext, type ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { ReferenceChip } from "@/components/ui/reference-chip";

const ReferenceContext = createContext<{ taskId: string; onNavigate: (id: string) => void } | null>(null);
export function CommentReferenceProvider({ taskId, onNavigate, children }: { taskId: string; onNavigate: (id: string) => void; children: ReactNode }) {
  return <ReferenceContext.Provider value={{ taskId, onNavigate }}>{children}</ReferenceContext.Provider>;
}
export function CommentReference({ reference, children }: { reference: { taskId: string; commentId: string }; children: ReactNode }) {
  const context = useContext(ReferenceContext);
  if (context?.taskId === reference.taskId) return <ReferenceChip icon={<MessageSquare />} type="button" onClick={() => context.onNavigate(reference.commentId)}>{children}</ReferenceChip>;
  return <ReferenceChip asChild icon={<MessageSquare />}><a href={`#comment-${encodeURIComponent(reference.commentId)}`}>{children}</a></ReferenceChip>;
}
