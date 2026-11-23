import type { CreditRate, TokenUsage } from "../domain/usage.ts";
// Published Standard credit rates, checked 2026-11-23. Never apply API dollar rates here.
const rates: Record<string, [number, number, number]> = {
  "gpt-6.2-astra": [200, 10, 1000], "gpt-6.2-sol": [50, 2.5, 250],
  "gpt-6.1-sol": [50, 2.5, 250], "gpt-6.1-terra": [25, 1.25, 125],
  "gpt-6-astra": [250, 25, 1250], "gpt-6-sol": [50, 5, 250], "gpt-6-luna": [2.5, .25, 12.5],
  "gpt-5.6-sol": [100, 10, 500], "gpt-5.6-terra": [50, 5, 300], "gpt-5.6-luna": [5, .5, 30],
  "gpt-5.3-codex": [43.75, 4.375, 350], "gpt-5.2": [43.75, 4.375, 350],
};
export function creditRate(model: string): CreditRate | null {
  const row = rates[model];
  return row ? { version: "2026-11-23", source: "https://help.openai.com/en/articles/11481834-chatgpt-rate-card-business-enterpriseedu-credit-based-pricing", input: row[0], cached: row[1], output: row[2] } : null;
}
export function credits(tokens: TokenUsage, rate: CreditRate) {
  return ((tokens.input_tokens - tokens.cached_input_tokens) * rate.input + tokens.cached_input_tokens * rate.cached + tokens.output_tokens * rate.output) / 1_000_000;
}
export function parseUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  for (const key of ["input_tokens", "cached_input_tokens", "output_tokens"])
    if (!Number.isSafeInteger(row[key]) || (row[key] as number) < 0) return null;
  if ((row.cached_input_tokens as number) > (row.input_tokens as number)) return null;
  if (row.reasoning_output_tokens !== undefined && (!Number.isSafeInteger(row.reasoning_output_tokens) || (row.reasoning_output_tokens as number) < 0 || (row.reasoning_output_tokens as number) > (row.output_tokens as number))) return null;
  return { input_tokens: row.input_tokens as number, cached_input_tokens: row.cached_input_tokens as number, output_tokens: row.output_tokens as number,
    ...(row.reasoning_output_tokens !== undefined ? { reasoning_output_tokens: row.reasoning_output_tokens as number } : {}) };
}
