"use client";

import { useState } from "react";
import type { AgentProfile } from "@/domain/column-agent";
import { workflowSteps, type Workflow, type WorkflowStep } from "@/domain/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function WorkflowEditor({ initial, agents, disabled, save, onSaved, onCancel }: {
  initial: Workflow; agents: AgentProfile[]; disabled: boolean;
  save: (workflow: Workflow) => Promise<Workflow>; onSaved: (workflow: Workflow) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [steps, setSteps] = useState(() => workflowSteps(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const invalidAgent = (step: WorkflowStep) => step.kind !== "checkpoint" && (!agents.some((agent) => agent.id === step.agentId) || (step.kind === "review" && !agents.some((agent) => agent.id === step.revisionAgentId)));
  const validation = !name.trim() ? "Enter a workflow name." : !steps.length ? "Add at least one step." : steps.some((step) => step.kind === "checkpoint" && !step.instructions.trim()) ? "Describe what the human must review." : steps.some((step) => step.kind === "review" && (!Number.isSafeInteger(step.maxRounds) || step.maxRounds <= 0 || !step.instructions.trim() || !step.revisionInstructions.trim())) ? "Provide review and revision instructions and a positive whole number of rounds." : steps.some(invalidAgent) ? "Choose an available agent for each step." : "";
  function update(id: string, changes: { instructions: string } | { agentId: string } | { revisionAgentId: string } | { revisionInstructions: string } | { maxRounds: number }) {
    setSteps((items) => items.map((step) => step.id === id ? ({ ...step, ...changes } as WorkflowStep) : step));
  }
  function move(index: number, offset: number) {
    setSteps((items) => {
      const reordered = [...items];
      [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
      return reordered;
    });
  }
  return <fieldset disabled={busy || disabled} className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Reusable workflow</legend>
    <p className="text-xs text-muted-foreground">Steps run from top to bottom. Changes apply to future executions; active executions retain their original configuration.</p>
    <div className="space-y-2"><Label htmlFor="workflow-name">Name</Label><Input id="workflow-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
    <ol className="space-y-3" aria-label="Workflow steps">{steps.map((step, index) => <li key={step.id} className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm font-medium">Step {index + 1}{step.kind === "checkpoint" ? " · Human approval" : step.kind === "review" ? " · Review ↔ Revise" : " · Agent"}</span>
        <Button type="button" size="sm" variant="ghost" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
        <Button type="button" size="sm" variant="ghost" aria-label={`Move step ${index + 1} down`} disabled={index === steps.length - 1} onClick={() => move(index, 1)}>↓</Button>
        <Button type="button" size="sm" variant="ghost" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps((items) => items.filter((item) => item.id !== step.id))}>Remove</Button>
      </div>
      {step.kind !== "checkpoint" && <div className="space-y-2"><Label htmlFor={`agent-${step.id}`}>{step.kind === "review" ? "Reviewer" : "Agent"}</Label><NativeSelect id={`agent-${step.id}`} value={step.agentId} aria-invalid={invalidAgent(step)} onChange={(event) => update(step.id, { agentId: event.target.value })}>
        {invalidAgent(step) && <option value={step.agentId}>Choose an available agent</option>}
        {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </NativeSelect>{invalidAgent(step) && <p className="text-sm text-destructive">Choose an available agent for step {index + 1}.</p>}</div>}
      <div className="space-y-2"><Label htmlFor={`instructions-${step.id}`}>{step.kind === "checkpoint" ? "Review instructions" : step.kind === "review" ? "Reviewer instructions" : "Step instructions"}</Label><Textarea id={`instructions-${step.id}`} rows={4} value={step.instructions} onChange={(event) => update(step.id, { instructions: event.target.value })} /></div>
      {step.kind === "review" && <div className="space-y-3">
        <div className="space-y-2"><Label htmlFor={`revision-agent-${step.id}`}>Revision agent</Label><NativeSelect id={`revision-agent-${step.id}`} value={step.revisionAgentId} onChange={(event) => update(step.id, { revisionAgentId: event.target.value })}>
          {!agents.some((agent) => agent.id === step.revisionAgentId) && <option value={step.revisionAgentId}>Choose an available agent</option>}
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </NativeSelect></div>
        <div className="space-y-2"><Label htmlFor={`revision-instructions-${step.id}`}>Revision instructions</Label><Textarea id={`revision-instructions-${step.id}`} value={step.revisionInstructions} onChange={(event) => update(step.id, { revisionInstructions: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor={`rounds-${step.id}`}>Review round limit</Label><Input id={`rounds-${step.id}`} type="number" min={1} step={1} value={step.maxRounds} onChange={(event) => update(step.id, { maxRounds: Number(event.target.value) })} /></div>
        <p className="text-xs text-muted-foreground">Review → Changes requested → Revise → Review again. Approval exits this section{index === steps.length - 1 ? " and completes the workflow" : ` to step ${index + 2}`}. At the limit, wait for a human before another revision.</p>
      </div>}
      {index < steps.length - 1 && <p className="text-xs text-muted-foreground">↓ On {step.kind === "checkpoint" || step.kind === "review" ? "approval" : "success"}, continue to step {index + 2}</p>}
    </li>)}</ol>
    <Button type="button" variant="outline" size="sm" onClick={() => setSteps((items) => [...items, { id: crypto.randomUUID(), agentId: agents[0]?.id ?? "", instructions: "" }])}>Add agent step</Button>
    <Button type="button" variant="outline" size="sm" onClick={() => setSteps((items) => [...items, { id: crypto.randomUUID(), kind: "checkpoint", instructions: "" }])}>Add human checkpoint</Button>
    <Button type="button" variant="outline" size="sm" onClick={() => setSteps((items) => [...items, { id: crypto.randomUUID(), kind: "review", agentId: agents[0]?.id ?? "", instructions: "", revisionAgentId: agents[0]?.id ?? "", revisionInstructions: "", maxRounds: 3 }])}>Add review section</Button>
    {(error || validation) && <p role="alert" className="text-sm text-destructive">{error || validation}</p>}
    <div className="flex gap-2"><Button type="button" size="sm" disabled={Boolean(validation)} onClick={async () => {
      setBusy(true); setError("");
      try { onSaved(await save({ id: initial.id, name, steps })); } catch (error) { setError(error instanceof Error ? error.message : "Could not save workflow."); } finally { setBusy(false); }
    }}>{busy ? "Saving…" : "Save workflow"}</Button><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button></div>
  </fieldset>;
}
