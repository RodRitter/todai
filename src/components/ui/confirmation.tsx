import type { ReactNode } from "react";
import { Item, ItemActions, ItemContent } from "./item";

// The shadcn Confirmation composition, with free-text answers for open questions.
export function Confirmation({ state, question, recommendation, children, layout = "default" }: {
  state: "pending" | "answered" | "cancelled";
  question: ReactNode;
  recommendation?: ReactNode;
  children?: ReactNode;
  layout?: "default" | "embedded";
}) {
  const body = <div className="space-y-3">
    {question}
    {recommendation && <div className="space-y-1 text-muted-foreground">
      <p className="text-xs font-medium">Recommendation</p>
      {recommendation}
    </div>}
  </div>;
  return <Item variant="default" size={layout === "embedded" ? "flush" : "sm"} role="group" aria-label="Feedback request">
    <ItemContent>
      <span className="mb-2 w-fit rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
        {state === "pending" ? "Feedback" : state === "answered" ? "Feedback received" : "Feedback cancelled"}
      </span>
      <div className="space-y-3">
        {body}
        {children}
      </div>
    </ItemContent>
  </Item>;
}

export function ConfirmationActions({ children }: { children: ReactNode }) {
  return <ItemActions className="flex-wrap justify-end">{children}</ItemActions>;
}
