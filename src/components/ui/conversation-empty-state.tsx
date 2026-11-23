import { MessageCircleDashed } from "lucide-react";

export function ConversationEmptyState({ variant }: { variant: "comments" | "chat" }) {
  const chat = variant === "chat";
  return <div data-slot="conversation-empty-state" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
    <div aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
      <MessageCircleDashed className="size-6" />
    </div>
    <div className="max-w-sm space-y-2">
      <h3 className="text-lg font-semibold text-foreground">{chat ? "Start a conversation" : "Add the first comment"}</h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {chat ? "Ask a question, discuss a comment, or leave a note." : "Share an update, ask a question, or request work."}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        Type <span className="font-semibold text-foreground">@</span> to search agents, artifacts, skills, and files.
      </p>
      {chat && <p className="text-xs leading-5 text-muted-foreground">Agents reply only when your message needs a response.</p>}
    </div>
  </div>;
}
