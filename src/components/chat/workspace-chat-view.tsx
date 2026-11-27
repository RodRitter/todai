"use client";

import { Fragment, useEffect, useState } from "react";
import { ArrowUp, ChevronDown, MessageSquare, Pencil, Plus, Trash2, Wrench, Check, X, Copy, LoaderCircle } from "lucide-react";
import type { WorkspaceChat, WorkspaceChatSummary, WorkspaceChatActivity, ChatModel } from "@/domain/workspace-chat";
import { executionTools, type ExecutorStatus } from "@/domain/column-agent";
import { NavigationTree } from "@/components/ui/navigation-tree";
import { SidebarPanel } from "@/components/ui/sidebar-panel";
import { WorkspaceLink } from "@/components/workspace-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageFooter, MessageAgentStatus } from "@/components/ui/message";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DeleteConfirmation } from "@/components/ui/delete-confirmation";
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from "@/components/ui/message-scroller";
import { Trace, TraceCollapsible, TraceCollapsibleTrigger, TraceLine, TraceTitle, TraceIcon, TraceCollapsibleContent, TraceOutput, runningTraceStepLimit } from "@/components/ui/trace";
import { Markdown } from "@/components/ui/markdown";
import { ConversationMessage } from "@/components/conversation/conversation-message";
import { PromptSend } from "@/components/ui/prompt-send";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { ConversationComposer } from "@/components/conversation/conversation-composer";
import { ConversationEmptyState } from "@/components/ui/conversation-empty-state";

export type WorkspaceChatViewProps = {
  chats: WorkspaceChatSummary[]; session: WorkspaceChat | null; statuses: ExecutorStatus[]; busy?: boolean; loading?: boolean; failed?: boolean;
  onSelect: (id: string) => void; onCreate: () => void; onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>; onModelChange: (model: ChatModel) => Promise<void>; onSend: (body: string, model: ChatModel) => Promise<void>; onRetry: () => void;
};
export function WorkspaceChatView(props: WorkspaceChatViewProps) {
  const { chats, session, busy, loading, failed, onSelect, onCreate, onRetry } = props;
  const [historyOpen, setHistoryOpen] = useState(false);
  return <TooltipProvider><main className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col md:flex-row" aria-busy={loading}>
    <Button className="m-4 md:hidden" variant="outline" aria-expanded={historyOpen} aria-controls="chat-history" onClick={() => setHistoryOpen(!historyOpen)}><MessageSquare />Conversations<ChevronDown /></Button>
    <aside id="chat-history" aria-label="Conversations" className={`${historyOpen ? "flex" : "hidden"} min-h-0 shrink-0 md:flex md:w-60`}>
      <SidebarPanel variant="chat"><ScrollArea className="max-h-64 min-h-0 flex-1 md:max-h-none"><nav aria-label="Chat navigation" className="p-3"><Button align="navigation" variant="ghost" disabled={busy || loading} onClick={onCreate}><Plus />New chat</Button><NavigationTree label="Conversations">
        {chats.map(chat => <Button key={chat.id} variant={session?.id === chat.id ? "secondary" : "ghost"} align="navigation" size="sm" disabled={busy} aria-current={session?.id === chat.id ? "true" : undefined} onClick={() => { onSelect(chat.id); setHistoryOpen(false); }} title={chat.title}><MessageSquare /><span className="truncate">{chat.title}</span></Button>)}
      </NavigationTree></nav></ScrollArea></SidebarPanel>
    </aside>
    <section aria-label="Workspace chat" className="mx-auto flex min-h-0 w-full min-w-0 max-w-4xl flex-1 flex-col gap-4 p-4 md:p-8">
      {failed && <Button variant="outline" onClick={onRetry}>Retry loading chat</Button>}
      {session ? <WorkspaceConversation key={session.id} {...props} session={session} /> : !loading && <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h2>Start a workspace conversation</h2><p>Ask a question or manage agents, boards, and columns.</p><Button onClick={onCreate} disabled={busy}><Plus />New chat</Button>
      </div>}
    </section>
  </main></TooltipProvider>;
}
function ToolActivity({ activity }: { activity: WorkspaceChatActivity }) {
  return <TraceCollapsible>
    <TraceCollapsibleTrigger><TraceLine status={activity.status}><TraceIcon>{activity.status === "error" ? <X /> : activity.status === "complete" ? <Check /> : <Wrench />}</TraceIcon><TraceTitle>{activity.name.replaceAll("_", " ")} — {activity.status}</TraceTitle></TraceLine></TraceCollapsibleTrigger>
    <TraceCollapsibleContent keepMounted><TraceOutput>{JSON.stringify({ input: activity.input, result: activity.result }, null, 2)}</TraceOutput></TraceCollapsibleContent>
  </TraceCollapsible>;
}
function WorkspaceToolTrace({ activities, running }: { activities: WorkspaceChatActivity[]; running: boolean }) {
  const [open, setOpen] = useState<boolean>();
  const hiddenCount = running ? Math.max(0, activities.length - runningTraceStepLimit) : 0;
  const status = running ? "running" : "complete";
  return <Trace><TraceCollapsible open={open ?? running} onOpenChange={setOpen} scrollBehavior={running ? "follow-expansion" : "preserve"}>
    <TraceCollapsibleTrigger><TraceLine status={status}>
      <TraceIcon motion={status === "running" ? "spin" : "none"}>{running ? <LoaderCircle /> : <Check />}</TraceIcon>
      <TraceTitle>{running ? "Working" : "Completed"} · {activities.length} {activities.length === 1 ? "step" : "steps"}</TraceTitle>
    </TraceLine></TraceCollapsibleTrigger>
    <TraceCollapsibleContent keepMounted><Trace role="list" aria-label="Agent activity">
      {hiddenCount > 0 && <TraceLine role="listitem" status="pending"><TraceTitle>{hiddenCount}+ more</TraceTitle></TraceLine>}
      {activities.slice(hiddenCount).map(activity => <div role="listitem" key={activity.id}><ToolActivity activity={activity} /></div>)}
    </Trace></TraceCollapsibleContent>
  </TraceCollapsible></Trace>;
}
function ReplyFooter({ body, model, effort }: { body: string; model?: string; effort?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); }, [copied]);
  return <MessageFooter className="gap-2"><Tooltip><TooltipTrigger asChild>
    <Button variant="ghost" size="icon-sm" aria-label={copied ? "Reply copied" : "Copy reply"} onClick={async () => {
      try { await navigator.clipboard.writeText(body); setCopied(true); } catch { toast.error("Could not copy the reply."); }
    }}>{copied ? <Check /> : <Copy />}</Button>
  </TooltipTrigger><TooltipContent>{copied ? "Copied" : "Copy reply"}</TooltipContent></Tooltip><span>{model} · {effort ?? "medium"}</span></MessageFooter>;
}
function WorkspaceConversation({ session, statuses, busy, onSend, onRename, onDelete, onModelChange }: WorkspaceChatViewProps & { session: WorkspaceChat }) {
  const [body, setBody] = useState("");
  const [selection, setSelection] = useState<ChatModel>({ tool: session.tool, model: session.model, effort: session.effort });
  const [rename, setRename] = useState(false), [title, setTitle] = useState(session.title), [remove, setRemove] = useState(false);
  const [customTool, setCustomTool] = useState<ChatModel["tool"]>(session.tool);
  const [custom, setCustom] = useState(false), [customModel, setCustomModel] = useState("");
  const [editing, setEditing] = useState(false), [submitting, setSubmitting] = useState(false);
  const locked = busy || session.running || editing || submitting;
  const unavailable = statuses.find(status => status.tool === selection.tool && (!status.installed || status.signedIn === false));
  async function changeModel(next: ChatModel) {
    if (locked) return;
    setEditing(true);
    try { await onModelChange(next); setSelection(next); } catch { /* The caller reports the failure. */ } finally { setEditing(false); }
  }
  async function send() {
    if (locked || !body.trim() || unavailable) return;
    const draft = body; setSubmitting(true); setBody("");
    try { await onSend(draft, selection); } catch { setBody(draft); } finally { setSubmitting(false); }
  }
  return <>
    <div className="flex items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{session.title}</h2>
      <Button variant="ghost" size="icon-sm" aria-label="Rename chat" disabled={locked} onClick={() => { setTitle(session.title); setRename(true); }}><Pencil /></Button>
      <Button variant="ghost-destructive" size="icon-sm" aria-label="Delete chat" disabled={locked} onClick={() => setRemove(true)}><Trash2 /></Button>
    </div>
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="min-h-0 flex-1"><MessageScrollerViewport><MessageScrollerContent className="pr-3 pb-4">
        {!session.messages.length && !locked && !session.error && <ConversationEmptyState variant="workspace-chat" />}
        {session.messages.map((message, index) => {
          if (message.authorRole !== "human") return null;
          const reply = session.messages[index + 1]?.authorRole === "agent" ? session.messages[index + 1] : undefined;
          const activities = session.activities.filter(activity => activity.turnId === message.id);
          const running = session.running && index === session.messages.length - 1;
          return <Fragment key={message.id}>
            <MessageScrollerItem messageId={message.id} scrollAnchor><ConversationMessage message={message} variant="chat" /></MessageScrollerItem>
            {(reply || activities.length > 0) && <MessageScrollerItem messageId={`${message.id}:response`}>
              <ConversationMessage message={reply ?? { id: `${message.id}:pending`, authorRole: "agent", authorName: "Assistant", body: "", createdAt: message.createdAt }} variant="chat"
                activity={activities.length > 0 && <WorkspaceToolTrace activities={activities} running={running} />}
                footer={reply && <ReplyFooter body={reply.body} model={reply.model} effort={reply.effort} />} />
            </MessageScrollerItem>}
          </Fragment>;
        })}
        {(session.running || submitting) && <MessageAgentStatus status="Running" />}
        {session.error && <Markdown>{session.error}</Markdown>}
      </MessageScrollerContent></MessageScrollerViewport><MessageScrollerButton /></MessageScroller>
    </MessageScrollerProvider>
    <ConversationComposer variant="fixed"><form onSubmit={event => { event.preventDefault(); void send(); }}>
      <Label htmlFor="workspace-chat-input" className="sr-only">Your chat message</Label>
      <InputGroup>
        <InputGroupTextarea variant="prompt" id="workspace-chat-input" placeholder="Ask a question or change workspace settings…" value={body} disabled={locked} maxLength={100000} onChange={event => setBody(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
        }} />
        <InputGroupAddon align="block-end" className="flex-wrap">
          <DropdownMenu><DropdownMenuTrigger asChild><InputGroupButton size="sm" className="ml-auto min-w-0 max-w-full" disabled={locked} aria-label={`Model: ${selection.tool}, ${selection.model}`}><span className="truncate">{selection.model}</span><ChevronDown /></InputGroupButton></DropdownMenuTrigger>
            <DropdownMenuContent align="start"><DropdownMenuRadioGroup value={`${selection.tool}:${selection.model}`} onValueChange={value => { const [tool, ...model] = value.split(":"); void changeModel({ tool: tool as ChatModel["tool"], model: model.join(":"), effort: (executionTools.find(item => item.value === tool)!.efforts as readonly string[]).includes(selection.effort) ? selection.effort : "medium" }); }}>
              {executionTools.map(tool => <DropdownMenuGroup key={tool.value}><DropdownMenuLabel>{tool.label}</DropdownMenuLabel>{tool.models.map(model => <DropdownMenuRadioItem key={model} value={`${tool.value}:${model}`}>{model}</DropdownMenuRadioItem>)}
              <DropdownMenuItem onSelect={() => { setCustomTool(tool.value); setCustomModel(""); setCustom(true); }}>Custom {tool.label} model…</DropdownMenuItem></DropdownMenuGroup>)}
            </DropdownMenuRadioGroup></DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu><DropdownMenuTrigger asChild><InputGroupButton size="sm" disabled={locked} aria-label={`Effort: ${selection.effort}`}>Effort {selection.effort}<ChevronDown /></InputGroupButton></DropdownMenuTrigger>
            <DropdownMenuContent align="start"><DropdownMenuRadioGroup value={selection.effort} onValueChange={effort => void changeModel({ ...selection, effort: effort as ChatModel["effort"] })}>
              <DropdownMenuLabel>Reasoning effort</DropdownMenuLabel>
              {executionTools.find(tool => tool.value === selection.tool)!.efforts.map(effort => <DropdownMenuRadioItem key={effort} value={effort}>{effort}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup></DropdownMenuContent>
          </DropdownMenu>
          <PromptSend type="submit" aria-label="Send message" disabled={locked || !body.trim() || !!unavailable}><ArrowUp /></PromptSend>
        </InputGroupAddon>
      </InputGroup>
      {unavailable && <p className="mt-2">{unavailable.message} <WorkspaceLink href="/settings?tab=executors">Open executor settings</WorkspaceLink></p>}
    </form></ConversationComposer>
    <Dialog open={rename} onOpenChange={value => { if (!editing) setRename(value); }}><DialogContent layout="prompt" closeDisabled={editing}>
      <DialogHeader><DialogTitle>Rename chat</DialogTitle><DialogDescription>Enter a title for this conversation.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async event => { event.preventDefault(); setEditing(true); try { await onRename(session.id, title); setRename(false); } catch {} finally { setEditing(false); } }}>
        <Label htmlFor="chat-title">Title</Label><Input id="chat-title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} disabled={editing} />
        <DialogFooter><Button type="submit" size="sm" disabled={editing || !title.trim()}>Save title</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
    <Dialog open={custom} onOpenChange={setCustom}><DialogContent layout="prompt"><DialogHeader><DialogTitle>Custom model</DialogTitle><DialogDescription>Enter a model supported by your {customTool === "codex" ? "Codex" : "Claude"} account.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (customModel.trim()) { void changeModel({ tool: customTool, model: customModel.trim(), effort: (executionTools.find(tool => tool.value === customTool)!.efforts as readonly string[]).includes(selection.effort) ? selection.effort : "medium" }); setCustom(false); } }}><Label htmlFor="custom-model">Model ID</Label><Input id="custom-model" value={customModel} onChange={event => setCustomModel(event.target.value)} required maxLength={200} /><DialogFooter><Button size="sm" type="submit" disabled={!customModel.trim()}>Use model</Button></DialogFooter></form>
    </DialogContent></Dialog>
    <DeleteConfirmation open={remove} onOpenChange={setRemove} title="Delete chat?" description="This deletes the conversation. Saved workspace changes remain." busy={editing} onConfirm={async () => { setEditing(true); try { await onDelete(session.id); } catch {} finally { setEditing(false); } }} />
  </>;
}
