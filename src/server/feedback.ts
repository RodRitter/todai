// A reserved final-response envelope shared by both CLI executors.
export function parseFeedback(summary: string): { question: string; recommendation: string } | undefined {
  const text = summary.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, "$1");
  let value;
  try { value = JSON.parse(text); }
  catch {
    if (/^\{\s*"type"\s*:\s*"feedback_request"/.test(text))
      throw new Error("The agent returned an invalid feedback request.");
    return;
  }
  if (value?.type !== "feedback_request") return;
  if (typeof value.question !== "string" || !value.question.trim() ||
      typeof value.recommendation !== "string" || !value.recommendation.trim())
    throw new Error("Feedback requests require a question and recommendation.");
  return { question: value.question.trim(), recommendation: value.recommendation.trim() };
}
