"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkspaceLink } from "@/components/workspace-selection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { AgentProfile } from "@/domain/column-agent";
import { workflowSteps, type Workflow } from "@/domain/workflow";
import { starterWorkflow, workflowTemplates, type WorkflowTemplate } from "@/domain/workflow-templates";
import { workflowApi, type WorkflowDefault } from "@/lib/workflow-api";
import { WorkflowEditor } from "./workflow-editor";

export function WorkflowLibrary({ agents, columns, api = workflowApi }: {
  agents: AgentProfile[];
  columns: readonly string[];
  api?: Pick<typeof workflowApi, "list" | "getDefault" | "setDefault" | "save">;
}) {
  const [data, setData] = useState<{ workflows: Workflow[]; defaults: WorkflowDefault }>();
  const [draft, setDraft] = useState<Workflow | null>(null);
  const [template, setTemplate] = useState<WorkflowTemplate>("single");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.list(controller.signal), api.getDefault(controller.signal)])
      .then(([workflows, defaults]) => {
        if (!controller.signal.aborted) { setData({ workflows, defaults }); setError(""); }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load workflows.");
      });
    return () => controller.abort();
  }, [api, attempt]);

  async function setDefault(id: string | null) {
    setBusy(true); setError("");
    try {
      const defaults = await api.setDefault(id);
      setData((current) => current && { ...current, defaults });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update the default workflow.");
    } finally { setBusy(false); }
  }

  return <AppShell screen="workflows" headerActions={
    <Button size="sm" disabled={!data || busy || Boolean(draft)} onClick={() => setDraft({ id: crypto.randomUUID(), name: "", steps: [] })}><Plus /> New workflow</Button>
  }>
    <main className="space-y-6 p-4 md:p-8" aria-label="Workflows">
      <div className="max-w-5xl space-y-6">
        <p className="text-sm text-muted-foreground">Create reusable workflows for this workspace, then select one when creating a task. Set a default to use it for new tasks automatically.</p>
        {!agents.length && <p className="text-sm">Create an agent in <WorkspaceLink href="/agents" className="underline">Agents</WorkspaceLink> before assigning agent steps.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error} {!data && <Button variant="ghost" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry</Button>}</p>}
        {!data && !error && <p role="status" className="text-sm text-muted-foreground">Loading workflows…</p>}
        {data && !draft && <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2"><Label htmlFor="library-workflow-template">Starter template</Label>
              <NativeSelect id="library-workflow-template" value={template} disabled={busy} onChange={(event) => setTemplate(event.target.value as WorkflowTemplate)}>
                {Object.entries(workflowTemplates).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </NativeSelect>
            </div>
            <Button variant="outline" disabled={busy} onClick={() => setDraft(starterWorkflow(template, crypto.randomUUID(), {}, columns))}>Create from template</Button>
          </div>
          {data.defaults.workflowId && !data.defaults.available && <p role="status" className="text-sm text-muted-foreground">The default workflow is unavailable. Edit its agents and milestones, choose another default, or clear it.</p>}
          {data.defaults.workflowId && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void setDefault(null)}>Clear workspace default</Button>}
          <Card className="gap-0 overflow-hidden py-0">
            {data.workflows.length ? <ul className="divide-y">{data.workflows.map((workflow) => {
              const steps = workflowSteps(workflow);
              return <li key={workflow.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="break-words text-sm font-medium">{workflow.name}{data.defaults.workflowId === workflow.id && <span className="ml-2 text-xs text-muted-foreground">Workspace default</span>}</h2>
                  <p className="text-xs text-muted-foreground">{steps.length} {steps.length === 1 ? "step" : "steps"} · {steps.map((step) => step.kind === "checkpoint" ? "Human approval" : step.kind === "review" ? "Review and revise" : agents.find((agent) => agent.id === step.agentId)?.name ?? "Unavailable agent").join(" → ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} aria-label={`Edit ${workflow.name}`} onClick={() => setDraft(workflow)}>Edit</Button>
                  {data.defaults.workflowId !== workflow.id && <Button size="sm" variant="ghost" disabled={busy} aria-label={`Use ${workflow.name} for new tasks`} onClick={() => void setDefault(workflow.id)}>Use for new tasks</Button>}
                </div>
              </li>;
            })}</ul> : <div className="space-y-2 px-4 py-6"><h2 className="text-sm font-medium">No workflows yet</h2><p className="text-sm text-muted-foreground">Choose a starter template or create a new workflow to add agent steps, human approvals, and review rounds.</p></div>}
          </Card>
        </>}
        {draft && <WorkflowEditor key={draft.id} initial={draft} agents={agents} columns={columns} disabled={busy} save={api.save} onCancel={() => setDraft(null)} onSaved={(workflow) => {
          setData((current) => current && { ...current, workflows: current.workflows.some((item) => item.id === workflow.id) ? current.workflows.map((item) => item.id === workflow.id ? workflow : item) : [...current.workflows, workflow] });
          setDraft(null);
          setAttempt((value) => value + 1);
        }} />}
      </div>
    </main>
  </AppShell>;
}
