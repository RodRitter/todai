export type TokenUsage = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens?: number;
};
export type UsageKind = "workflow" | "reply" | "chat" | "background";
export const usageLabels: Record<UsageKind, string> = { workflow: "Workflow", reply: "Replies", chat: "Chat", background: "Background checks" };
export type CreditRate = { version: string; source: string; input: number; cached: number; output: number };
export type UsageCall = {
  id: string; agentName: string; model: string; effort: string | null; kind: UsageKind;
  startedAt: string; finishedAt: string | null;
  outcome: "Running" | "Complete" | "Failed" | "Interrupted";
  complete: boolean; tokens: TokenUsage | null; rate: CreditRate | null; credits: number | null;
};
export type UsageTotals = { calls: number; measured: number; priced: number; tokens: number; uncachedInput: number; cachedInput: number; output: number; credits: number; unknown: number; unpriced: number; pending: number };
export type TaskUsage = { trackingSince: string; totals: UsageTotals; groups: Record<UsageKind, UsageTotals>; models: ModelUsage[]; calls: UsageCall[] };
export function usageTotals(calls: UsageCall[]): UsageTotals {
  return calls.reduce((sum, call) => ({ calls: sum.calls + 1, measured: sum.measured + Number(call.tokens !== null), priced: sum.priced + Number(call.credits !== null),
    tokens: sum.tokens + (call.tokens ? call.tokens.input_tokens + call.tokens.output_tokens : 0),
    uncachedInput: sum.uncachedInput + (call.tokens ? call.tokens.input_tokens - call.tokens.cached_input_tokens : 0),
    cachedInput: sum.cachedInput + (call.tokens?.cached_input_tokens ?? 0), output: sum.output + (call.tokens?.output_tokens ?? 0),
    credits: sum.credits + (call.credits ?? 0), unknown: sum.unknown + Number(!call.complete && call.outcome !== "Running"),
    unpriced: sum.unpriced + Number(!!call.tokens && !call.rate), pending: sum.pending + Number(call.outcome === "Running"),
  }), { calls: 0, measured: 0, priced: 0, tokens: 0, uncachedInput: 0, cachedInput: 0, output: 0, credits: 0, unknown: 0, unpriced: 0, pending: 0 });
}

export type TaskUsageOverview = Omit<TaskUsage, "calls">;

export type ModelUsage = { model: string; effort: string | null; totals: UsageTotals };
export function modelUsage(calls: UsageCall[]): ModelUsage[] {
  const groups = new Map<string, UsageCall[]>();
  for (const call of calls) {
    const key = JSON.stringify([call.model, call.effort]);
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ model: group[0].model, effort: group[0].effort, totals: usageTotals(group) }))
    .sort((a, b) => a.model.localeCompare(b.model) || (a.effort ?? "").localeCompare(b.effort ?? ""));
}

export type WorkspaceCredits = {
  trackedCredits?: number; creditLimit?: number;
  credits: number; calls: number; priced: number; measured: number;
  breakdown: Record<"uncachedInput" | "cachedInput" | "output", { tokens: number; credits: number }>;
};

export type TaskCreditUsage = Pick<UsageTotals, "credits" | "calls" | "priced" | "pending">;
