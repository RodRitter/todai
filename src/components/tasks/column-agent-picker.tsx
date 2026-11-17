"use client";

import { useRef, useState } from "react";
import { Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notifyOperation } from "@/components/ui/toast";
import { executorLabel, type AgentProfile } from "@/domain/column-agent";
import type { Status } from "@/domain/task";

export function ColumnAgentPicker({
  column,
  agents,
  agentId,
  disabled = false,
  onSave,
}: {
  column: Status;
  agents: AgentProfile[];
  agentId?: string;
  disabled?: boolean;
  onSave: (agentId: string | null) => Promise<void>;
}) {
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  async function save(value: string) {
    if (saving.current || disabled) return;
    const selected = value === "none" ? null : value.slice("agent:".length);
    if (selected === (agentId ?? null)) return;
    saving.current = true;
    setBusy(true);
    try {
      await notifyOperation(() => onSave(selected), {
        loading: "Saving agent assignment…",
        success: selected ? "Agent assigned." : "Agent removed from column.",
        error:
          "Could not save assignment. Reload to check available agents, or try again.",
      });
    } catch {
      // Keep the saved assignment displayed when the update fails.
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Select
      value={agentId ? `agent:${agentId}` : "none"}
      onValueChange={(value) => void save(value)}
      disabled={disabled || busy}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Agent for ${column}`}
        aria-busy={busy}
        className="max-w-full gap-1 rounded-full bg-secondary px-2 py-0 text-[11px] text-secondary-foreground shadow-none data-[size=sm]:h-6 [&_svg]:size-3 [&_[data-slot=select-value]]:min-w-0"
      >
        <Bot className="size-3" aria-hidden="true" />
        <SelectValue placeholder="No agent">
          {agents.find((agent) => agent.id === agentId)?.name ?? "No agent"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value="none">No agent</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={`agent:${agent.id}`}>
            {agent.name} · {executorLabel(agent.tool)}
          </SelectItem>
        ))}
        {!agents.length && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Create an agent in Agents to assign it here.
          </p>
        )}
      </SelectContent>
    </Select>
  );
}
