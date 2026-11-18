"use client";

import { useEffect, useState } from "react";
import type { AgentProfile } from "@/domain/column-agent";
import type { Workflow } from "@/domain/workflow";
import { workflowApi, type WorkflowDefault } from "@/lib/workflow-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { TaskWorkflow } from "./task-workflow";

export function NewTaskWorkflow({ value, onChange, agents, columns, disabled }: {
  value: string | null | undefined; onChange: (id: string | null) => void;
  agents: AgentProfile[]; columns: readonly string[]; disabled: boolean;
}) {
  const [data, setData] = useState<{ workflows: Workflow[]; defaults: WorkflowDefault }>();
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([workflowApi.list(controller.signal), workflowApi.getDefault(controller.signal)]).then(([workflows, defaults]) => {
      if (!controller.signal.aborted) { setData({ workflows, defaults }); setError(""); }
    }).catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load workflows."); });
    return () => controller.abort();
  }, [setup, attempt]);
  return <section className="space-y-2" aria-label="New task workflow">
    <Label htmlFor="new-task-workflow">Workflow</Label>
    <NativeSelect id="new-task-workflow" disabled={disabled || !data} value={value === undefined ? "default" : value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      {value === undefined && <option value="default">{!data ? "Loading workspace default…" : data.defaults.available ? `Workspace default: ${data.workflows.find((workflow) => workflow.id === data.defaults.workflowId)?.name}` : "No available workspace default"}</option>}
      <option value="">No workflow — set up before running</option>
      {value && !data?.workflows.some((workflow) => workflow.id === value) && <option value={value}>Selected workflow</option>}
      {data?.workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
    </NativeSelect>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></p>}
    {data && !data.defaults.available && <p className="text-sm text-muted-foreground">{data.defaults.workflowId ? "The default workflow is unavailable. Repair its agents and milestones or choose another workflow." : "Choose a workflow or set up a starter template. You can make it the workspace default for future tasks."}</p>}
    <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setSetup(!setup)}>{setup ? "Close workflow setup" : "Set up workflows"}</Button>
    {setup && <TaskWorkflow taskId="" workflowId={value === undefined ? data?.defaults.available ? data.defaults.workflowId : null : value} onChange={onChange} agents={agents} columns={columns} disabled={disabled} />}
  </section>;
}
