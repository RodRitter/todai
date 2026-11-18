"use client";

import { useEffect, useState } from "react";
import type { AgentProfile } from "@/domain/column-agent";
import type { Workflow, WorkflowExecution } from "@/domain/workflow";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { AgentStatus } from "./agent-status";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await workspaceFetch(url, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Could not load workflows.");
  return value;
}
const workflowApi = {
  list: (signal: AbortSignal) => request<Workflow[]>("/api/workflows", { signal }),
  history: (taskId: string, signal: AbortSignal) => request<WorkflowExecution[]>(`/api/workflows?${new URLSearchParams({ taskId })}`, { signal }),
  save: (workflow: Workflow) => request<Workflow>("/api/workflows", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workflow) }),
};

export function TaskWorkflow({ taskId, workflowId, onChange, agents = [], disabled, api = workflowApi }: {
  taskId: string;
  workflowId: string | null;
  onChange: (id: string | null) => void;
  agents?: AgentProfile[];
  disabled: boolean;
  api?: typeof workflowApi;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [history, setHistory] = useState<WorkflowExecution[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Workflow | null>(null);
  const selected = workflows.find((item) => item.id === workflowId);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const [definitions, executions] = await Promise.all([api.list(controller.signal), api.history(taskId, controller.signal)]);
        if (!controller.signal.aborted) { setWorkflows(definitions); setHistory(executions); setLoaded(true); setError(""); }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load workflows.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [taskId, api, attempt]);

  return <section className="space-y-4" aria-label="Task workflow">
    <div className="space-y-2">
      <Label htmlFor="task-workflow">Workflow</Label>
      <NativeSelect id="task-workflow" value={workflowId ?? ""} disabled={disabled || !loaded} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Use column agent (legacy)</option>
        {workflowId && !selected && <option value={workflowId}>Unavailable workflow — choose another</option>}
        {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
      </NativeSelect>
      <p className="text-sm text-muted-foreground">{workflowId ? "Save task changes, then Run. This workflow runs independently of column automation." : "No workflow is configured. Runs currently use the agent assigned to the task’s board column."}</p>
      {!loaded && !error && <p role="status" className="text-sm text-muted-foreground">Loading workflows…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || !loaded || !agents.length} onClick={() => setDraft({ id: crypto.randomUUID(), name: "", agentId: agents[0]?.id ?? "", instructions: "" })}>Create workflow</Button>
        {selected && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setDraft({ ...selected })}>Edit workflow</Button>}
      </div>
      {!agents.length && <p className="text-sm text-muted-foreground">Create an agent in Agents before configuring a workflow.</p>}
    </div>
    {draft && <WorkflowEditor key={draft.id} initial={draft} agents={agents} disabled={disabled} save={api.save} onCancel={() => setDraft(null)} onSaved={(workflow) => {
      setWorkflows((items) => [...items.filter((item) => item.id !== workflow.id), workflow]);
      onChange(workflow.id); setDraft(null);
    }} />}
    {selected && <details className="text-sm"><summary className="cursor-pointer">Configured step · {agents.find((agent) => agent.id === selected.agentId)?.name ?? "Agent unavailable"}</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{selected.instructions || "No additional step instructions."}</pre></details>}
    <div className="space-y-3">
      <h3 className="font-semibold">Workflow executions</h3>
      {loaded && !history.length && <p className="text-sm text-muted-foreground">No workflow executions yet.</p>}
      {history.map((execution) => <details key={execution.id} className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm"><span className="font-medium">{execution.workflow.name}</span> · <AgentStatus status={execution.status} /> <time className="text-xs text-muted-foreground" dateTime={execution.createdAt}>{new Date(execution.createdAt).toLocaleString()}</time></summary>
        <div className="mt-4 space-y-4 text-sm">
          <p>Agent step · {execution.profile.name} · {execution.profile.tool} / {execution.profile.model}</p>
          <details><summary className="cursor-pointer">Step instructions used</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{execution.workflow.instructions || "No additional step instructions."}</pre></details>
          <ol className="space-y-4" aria-label="Step attempts">{execution.runs.map((run, index) => <li key={run.id} className="space-y-2 border-t pt-3">
            <p>Attempt {index + 1} · <AgentStatus status={run.status} /></p>
            {run.prompt !== null ? <details><summary className="cursor-pointer">Exact supplied agent prompt</summary><p className="my-2 text-xs text-muted-foreground">The prompt Todai supplied to the executor. Provider instructions and private reasoning are not included.</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{run.prompt}</pre></details> : <p className="text-xs text-muted-foreground">No prompt was supplied for this attempt yet.</p>}
            {run.summary && <details><summary className="cursor-pointer">Result</summary><div className="mt-2"><Markdown>{run.summary}</Markdown></div></details>}
          </li>)}</ol>
        </div>
      </details>)}
    </div>
  </section>;
}

function WorkflowEditor({ initial, agents, disabled, save, onSaved, onCancel }: {
  initial: Workflow; agents: AgentProfile[]; disabled: boolean;
  save: typeof workflowApi.save; onSaved: (workflow: Workflow) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <fieldset disabled={busy || disabled} className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Reusable workflow</legend>
    <p className="text-xs text-muted-foreground">Changes apply to future executions in this workspace. Active executions retain their original configuration.</p>
    <div className="space-y-2"><Label htmlFor="workflow-name">Name</Label><Input id="workflow-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor="workflow-agent">Agent</Label><NativeSelect id="workflow-agent" value={draft.agentId} onChange={(event) => setDraft({ ...draft, agentId: event.target.value })}>
      {!agents.some((agent) => agent.id === draft.agentId) && <option value={draft.agentId}>Choose an available agent</option>}
      {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
    </NativeSelect></div>
    <div className="space-y-2"><Label htmlFor="workflow-instructions">Step instructions</Label><Textarea id="workflow-instructions" rows={5} value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="button" size="sm" disabled={!draft.name.trim() || !agents.some((agent) => agent.id === draft.agentId)} onClick={async () => {
      setBusy(true); setError("");
      try { onSaved(await save(draft)); } catch (error) { setError(error instanceof Error ? error.message : "Could not save workflow."); } finally { setBusy(false); }
    }}>{busy ? "Saving…" : "Save workflow"}</Button><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button></div>
  </fieldset>;
}
