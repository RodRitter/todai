import type { RunActivityUpdate } from "../domain/execution.ts";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value !== null && typeof value === "object" ? value as RecordValue : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const bounded = (value: string) => value.length > 16000 ? `${value.slice(0, 15950)}\n[Output truncated]` : value;
function contentText(value: unknown): string {
  if (typeof value === "string") return bounded(value);
  return Array.isArray(value) ? bounded(value.filter(part => object(part).type === "text").map(part => text(object(part).text)).join("\n")) : "";
}

// Allow only observable activity. Reasoning, prompt events, and unknown event fields are not copied.
export function codexActivity(value: unknown): RunActivityUpdate | undefined {
  const event = object(value);
  if (!["item.started", "item.updated", "item.completed"].includes(text(event.type))) return;
  const item = object(event.item);
  if (!text(item.id)) return;
  const status = item.status === "failed" || (typeof item.exit_code === "number" && item.exit_code !== 0)
    ? "error" : event.type === "item.completed" ? "complete" : "running";
  const base = { id: text(item.id), status } as const;
  switch (item.type) {
    case "command_execution": return { ...base, title: text(item.command) || "Command", detail: bounded(text(item.aggregated_output)) || undefined };
    case "file_change": return { ...base, title: "File changes", detail: bounded((Array.isArray(item.changes) ? item.changes : []).map(change => {
      const file = object(change); return `${text(file.kind)} ${text(file.path)}`;
    }).join("\n")) };
    case "web_search": return { ...base, title: `Web search: ${text(item.query)}` };
    case "mcp_tool_call": return { ...base, toolName: text(item.tool) || undefined, title: item.tool === "search_memory" ? `Checking memories for ${text(object(item.arguments).query).slice(0, 80) || "this task"}` : item.tool === "read_memory" ? "Reading saved memories" : `${text(item.server)}: ${text(item.tool)}`, detail: bounded(text(object(item.error).message) || contentText(object(item.result).content)) || undefined };
    case "error": return { ...base, status: "error", title: "Activity failed", detail: bounded(text(item.message)) };
  }
}

export function createClaudeActivity(emit: (activity: RunActivityUpdate) => void) {
  const calls = new Map<string, RunActivityUpdate>();
  return (value: unknown) => {
    const event = object(value);
    if (event.type !== "assistant" && event.type !== "user") return;
    const content = object(event.message).content;
    if (!Array.isArray(content)) return;
    for (const value of content) {
      const block = object(value);
      if (event.type === "assistant" && block.type === "tool_use" && text(block.id)) {
        const input = object(block.input);
        const name = text(block.name) || "Tool";
        const target = name === "Bash" ? text(input.command) : ["Read", "Edit", "Write"].includes(name) ? text(input.file_path) : name === "WebSearch" ? text(input.query) : "";
        const activity: RunActivityUpdate = { id: text(block.id), toolName: name, filePath: name === "Read" ? text(input.file_path) || undefined : undefined, title: name.endsWith("search_memory") ? `Checking memories for ${text(input.query).slice(0, 80) || "this task"}` : name.endsWith("read_memory") ? "Reading saved memories" : target ? `${name}: ${target}` : name, status: "running" };
        calls.set(activity.id, activity);
        emit(activity);
      } else if (event.type === "user" && block.type === "tool_result") {
        const activity = calls.get(text(block.tool_use_id));
        if (!activity) continue;
        const result: RunActivityUpdate = { ...activity, status: block.is_error ? "error" : "complete", detail: contentText(block.content) || undefined };
        calls.set(activity.id, result);
        emit(result);
      }
    }
  };
}
