import type { AgentProfile } from "./column-agent.ts";

export function agentMentionPath(id: string) {
  return `#agent/${encodeURIComponent(id)}`;
}

/** Resolve explicit mention links and typed names; code and ordinary links are context. */
export function mentionedAgentIds(body: string, agents: Pick<AgentProfile, "id" | "name">[]): string[] {
  const text = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, (value) => " ".repeat(value.length));
  const matches: { index: number; id: string }[] = [];
  const plain = text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (value, label: string, path: string, index: number) => {
    if (label.startsWith("@") && path.startsWith("#agent/")) {
      try { matches.push({ index, id: decodeURIComponent(path.slice(7)) }); } catch { /* Malformed links are context. */ }
    }
    return " ".repeat(value.length);
  });
  // Longest names win when one agent's name is a prefix of another's.
  const names = [...agents].sort((a, b) => b.name.length - a.name.length);
  const occupied = new Set<number>();
  for (const agent of names) {
    const escaped = agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_@])@${escaped}(?=$|[^\\p{L}\\p{N}_-])`, "giu");
    for (const match of plain.matchAll(pattern)) {
      const index = match.index + match[1].length;
      if (!occupied.has(index)) {
        matches.push({ index, id: agent.id });
        occupied.add(index);
      }
    }
  }
  return [...new Set(matches.sort((a, b) => a.index - b.index).map((match) => match.id))];
}
