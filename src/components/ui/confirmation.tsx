import type { ReactNode } from "react";
import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "./item";

// The shadcn Confirmation composition, with free-text answers for open questions.
export function Confirmation({ state, question, recommendation, children }: {
  state: "pending" | "answered" | "cancelled";
  question: ReactNode;
  recommendation?: ReactNode;
  children?: ReactNode;
}) {
  const Icon = state === "pending" ? CircleHelp : state === "answered" ? CircleCheck : CircleX;
  return <Item variant={state === "pending" ? "outline" : "default"} size="sm" role="group" aria-label="Feedback request">
    <ItemMedia variant="icon" className="self-start"><Icon aria-hidden="true" /></ItemMedia>
    <ItemContent>
      <ItemTitle>{state === "pending" ? "Your feedback is needed" : state === "answered" ? "Feedback received" : "Feedback cancelled"}</ItemTitle>
      <div className="space-y-3">
        {question}
        {recommendation && <div className="space-y-1 text-muted-foreground">
          <p className="text-xs font-medium">Recommendation</p>
          {recommendation}
        </div>}
        {children}
      </div>
    </ItemContent>
  </Item>;
}

export function ConfirmationActions({ children }: { children: ReactNode }) {
  return <ItemActions className="flex-wrap justify-end">{children}</ItemActions>;
}
