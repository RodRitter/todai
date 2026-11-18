"use client";

import { useEffect, useState } from "react";
import type { AgentProfile } from "@/domain/column-agent";
import { reviewPhaseLabels, workflowSteps, type Workflow, type WorkflowExecution } from "@/domain/workflow";
import { workflowApi, type WorkflowDefault } from "@/lib/workflow-api";
import { starterWorkflow, workflowTemplates, type WorkflowTemplate } from "@/domain/workflow-templates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Markdown } from "@/components/ui/markdown";
import { CommentAttachments } from "@/components/artifacts/artifact-attachments";
import { HistoryGroup, HistoryPage } from "./review-history";
import { WorkflowEditor } from "./workflow-editor";
import { AgentStatus } from "./agent-status";

export function TaskWorkflow({ taskId, workflowId, onChange, agents = [], columns = [], disabled, onHistory, api = workflowApi }: {
  columns?: readonly string[];
  taskId: string;
  workflowId: string | null;
  onChange: (id: string | null) => void;
  agents?: AgentProfile[];
  disabled: boolean;
  api?: Omit<typeof workflowApi, "getDefault" | "setDefault"> & Partial<Pick<typeof workflowApi, "getDefault" | "setDefault">>;
  onHistory?: (history: WorkflowExecution[]) => void;
}) {
  const [workspaceDefault, setWorkspaceDefault] = useState<WorkflowDefault>();
  const [settingDefault, setSettingDefault] = useState(false);
  const [template, setTemplate] = useState<WorkflowTemplate>("single");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [history, setHistory] = useState<WorkflowExecution[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [draft, setDraft] = useState<Workflow | null>(null);
  const selected = workflows.find((item) => item.id === workflowId);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const [definitions, executions, defaultValue] = await Promise.all([api.list(controller.signal), taskId ? api.history(taskId, controller.signal) : Promise.resolve([]), api.getDefault?.(controller.signal)]);
        if (!controller.signal.aborted) setWorkspaceDefault(defaultValue);
        if (!controller.signal.aborted) { setWorkflows(definitions); setHistory(executions); onHistory?.(executions); setLoaded(true); setError(""); }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load workflows.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [taskId, api, attempt, onHistory]);

  async function updateDefault(workflowId: string | null) {
    if (!api.setDefault) return;
    setSettingDefault(true);
    try { setWorkspaceDefault(await api.setDefault(workflowId)); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not update the workspace default."); }
    finally { setSettingDefault(false); }
  }

  return <section className="space-y-4" aria-label="Task workflow">
    <div className="space-y-2">
      <Label htmlFor="task-workflow">Workflow</Label>
      <NativeSelect id="task-workflow" value={workflowId ?? ""} disabled={disabled || !loaded} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Choose a workflow</option>
        {workflowId && !selected && <option value={workflowId}>Unavailable workflow — choose another</option>}
        {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
      </NativeSelect>
      <p className="text-sm text-muted-foreground">{workflowId ? "Save task changes, then Run. Workflow milestones control board status." : "Choose or create a workflow, save the task, then press Run."}</p>
      {!loaded && !error && <p role="status" className="text-sm text-muted-foreground">Loading workflows…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></p>}
      {workspaceDefault && <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Workspace default: {workspaceDefault.available ? workflows.find((item) => item.id === workspaceDefault.workflowId)?.name : workspaceDefault.workflowId ? "Unavailable — repair its agents and milestones or choose another workflow." : "None — choose a workflow below and make it the default for new tasks."}</p>
        <Button type="button" variant="outline" size="sm" disabled={disabled || settingDefault || !selected || !api.setDefault} onClick={() => selected && void updateDefault(selected.id)}>Use selected workflow for new tasks</Button>
        {workspaceDefault.workflowId && <Button type="button" variant="ghost" size="sm" disabled={disabled || settingDefault || !api.setDefault} onClick={() => void updateDefault(null)}>Clear workspace default</Button>}
      </div>}
      <div className="space-y-2">
        <Label htmlFor="workflow-template">Starter template</Label>
        <NativeSelect id="workflow-template" value={template} disabled={disabled} onChange={(event) => setTemplate(event.target.value as WorkflowTemplate)}>
          {Object.entries(workflowTemplates).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </NativeSelect>
        <Button type="button" variant="outline" size="sm" disabled={disabled || !loaded} onClick={() => setDraft(starterWorkflow(template, crypto.randomUUID(), {}, columns))}>Create from template</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || !loaded} onClick={() => setDraft({ id: crypto.randomUUID(), name: "", steps: [] })}>Create workflow</Button>
        {selected && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setDraft({ ...selected })}>Edit workflow</Button>}
      </div>
      {!agents.length && <p className="text-sm text-muted-foreground">Create an agent in Agents to add agent steps. Human checkpoints can be used on their own.</p>}
    </div>
    {draft && <WorkflowEditor key={draft.id} initial={draft} agents={agents} columns={columns} disabled={disabled} save={api.save} onCancel={() => setDraft(null)} onSaved={(workflow) => {
      setWorkflows((items) => [...items.filter((item) => item.id !== workflow.id), workflow]);
      onChange(workflow.id); setDraft(null);
    }} />}
    {selected && <ol className="space-y-2" aria-label="Configured steps">{workflowSteps(selected).map((step, index) => <li key={step.id} className="rounded-lg border p-3 text-sm">
      <details><summary className="cursor-pointer">{index + 1}. {step.kind === "checkpoint" ? "Human approval" : step.kind === "review" ? "Review ↔ Revise" : agents.find((agent) => agent.id === step.agentId)?.name ?? "Agent unavailable"}</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{step.instructions || "No additional step instructions."}</pre></details>
      {step.kind === "review" && <p className="mt-2 text-xs text-muted-foreground">Reviewer: {agents.find((agent) => agent.id === step.agentId)?.name ?? "Unavailable"} · Revision agent: {agents.find((agent) => agent.id === step.revisionAgentId)?.name ?? "Unavailable"} · {step.maxRounds} rounds. Changes requested → Revise → Review. Approval exits; limit reached → Human intervention.</p>}
      {index < workflowSteps(selected).length - 1 && <p className="mt-2 text-xs text-muted-foreground">↓ On {step.kind === "checkpoint" || step.kind === "review" ? "approval" : "success"}, continue to step {index + 2}</p>}
    </li>)}</ol>}
    {taskId && <div className="space-y-3">
      <h3 className="font-semibold">Workflow executions</h3>
      {loaded && !history.length && <p className="text-sm text-muted-foreground">No workflow executions yet.</p>}
      {<HistoryPage label="executions" items={history} render={(execution) => <HistoryGroup key={execution.id} title={<><span className="font-medium">{execution.workflow.name}</span> · <AgentStatus status={execution.status} /> <time className="text-xs text-muted-foreground" dateTime={execution.createdAt}>{new Date(execution.createdAt).toLocaleString()}</time></>}>
        <div className="mt-4 space-y-4 text-sm">
          <p>Current step: {(execution.steps?.findIndex((step) => step.id === execution.stepId) ?? 0) + 1}</p>
          <ol className="space-y-2" aria-label="Step progress">{(execution.steps ?? workflowSteps(execution.workflow).map((step) => ({ ...step, profile: execution.profile, review: undefined, status: execution.status }))).map((step, index) => <li key={step.id} className="rounded border p-3">
            <p>{index + 1}. {step.profile?.name ?? "Human approval"} · <AgentStatus status={step.status} />{step.id === execution.stepId && execution.status !== "Complete" ? " · Current step" : ""}</p>
            {step.review && <div className="space-y-2">
              <p>Round {step.review.round} of {step.review.limit} · {reviewPhaseLabels[step.review.phase]}{step.review.phase === "intervention" && " — respond in Overview"}</p>
              {step.review.findings && <Markdown>{step.review.findings}</Markdown>}
              <ol className="space-y-2" aria-label="Review rounds">{step.review.attempts.map((attempt) => <li key={attempt.runId}>
                <a href={`#workflow-run-${attempt.runId}`} className="underline">Round {attempt.round} · {attempt.role === "review" ? "Reviewer" : "Revision"} attempt</a>{attempt.outcome && ` · ${attempt.outcome}`}
                {attempt.reviewedRunId && <p><a className="underline" href={`#workflow-run-${attempt.reviewedRunId}`}>Reviewed attempt</a></p>}
                {!!attempt.reviewedArtifacts?.length && <div><p>Reviewed revisions</p><CommentAttachments references={attempt.reviewedArtifacts} /></div>}
                {!!attempt.artifacts?.length && <div><p>Review evidence</p><CommentAttachments references={attempt.artifacts} /></div>}
                {attempt.findings && <details><summary className="cursor-pointer">Findings</summary><Markdown>{attempt.findings}</Markdown></details>}
              </li>)}</ol>
            </div>}
            {step.profile && <p className="text-xs text-muted-foreground">{step.profile.tool} / {step.profile.model}</p>}
            <details><summary className="cursor-pointer">Step instructions used</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{step.instructions || "No additional step instructions."}</pre></details>
          </li>)}</ol>
          {execution.id === history[0]?.id && workflowId === execution.workflow.id && ["Failed", "Interrupted", "Stopped"].includes(execution.status) && <div className="space-y-2">
            <p>Retry continues from the current step using saved workspace changes. Completed steps are preserved; files are not rolled back. If the queue is paused, resume it separately.</p>
            <Button type="button" size="sm" disabled={disabled || retrying} onClick={async () => {
              setRetrying(true); setError("");
              try { await api.retry(taskId, execution.id); setAttempt((value) => value + 1); }
              catch (error) { setError(error instanceof Error ? error.message : "Could not retry this step."); }
              finally { setRetrying(false); }
            }}>{retrying ? "Retrying…" : "Retry current step"}</Button>
          </div>}
          <ol className="space-y-4" aria-label="Step attempts">{execution.runs.map((run, index) => <li key={run.id} id={`workflow-run-${run.id}`} className="space-y-2 border-t pt-3">
            <p>{run.stepId && `Step ${workflowSteps(execution.workflow).findIndex((step) => step.id === run.stepId) + 1} · `}Attempt {index + 1} · <AgentStatus status={run.status} /></p>
            {run.prompt !== null ? <details><summary className="cursor-pointer">Exact supplied agent prompt</summary><p className="my-2 text-xs text-muted-foreground">The prompt Todai supplied to the executor. Provider instructions and private reasoning are not included.</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{run.prompt}</pre></details> : <p className="text-xs text-muted-foreground">No prompt was supplied for this attempt yet.</p>}
            {run.summary && <details><summary className="cursor-pointer">Result</summary><div className="mt-2"><Markdown>{run.summary}</Markdown></div></details>}
          </li>)}</ol>
        </div>
      </HistoryGroup>} />}
    </div>}
  </section>;
}
