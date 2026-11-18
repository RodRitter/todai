"use client";

import { useState, type ReactNode } from "react";
import type { WorkflowExecution } from "@/domain/workflow";
import type { TaskComment } from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { CommentAttachments } from "@/components/artifacts/artifact-attachments";
import { TaskActivity } from "./task-comments";

export const findingRecordId = (executionId: string, stepId: string, findingId: string) => `finding-${executionId}-${stepId}-${findingId}`;

// Keep expanded content mounted so tab switches and polling preserve reading state.
export function HistoryGroup({ title, children, initialOpen = false, reveal }: { title: ReactNode; children: ReactNode; initialOpen?: boolean; reveal?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const [visited, setVisited] = useState(initialOpen);
  const [lastReveal, setLastReveal] = useState<string>();
  if (reveal && reveal !== lastReveal) { setLastReveal(reveal); setOpen(true); setVisited(true); }
  return <details open={open} onToggle={(event) => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setVisited(true); }} className="rounded-lg border p-3">
    <summary className="cursor-pointer text-sm font-medium">{title}</summary>
    {visited && <div className="mt-3 space-y-4">{children}</div>}
  </details>;
}

export function HistoryPage<T>({ items, render, targetIndex = -1, label }: { items: T[]; render: (item: T, index: number) => ReactNode; targetIndex?: number; label: string }) {
  const [count, setCount] = useState(10);
  const visible = Math.max(count, targetIndex + 1);
  if (visible > count) setCount(visible);
  return <div className="space-y-3">{items.slice(0, visible).map(render)}
    {visible < items.length && <Button type="button" variant="outline" size="sm" onClick={() => setCount(visible + 10)}>Show more {label} ({items.length - visible} remaining)</Button>}
  </div>;
}

export function OutstandingFindings({ executions, onNavigate }: { executions: WorkflowExecution[]; onNavigate: (id: string) => void }) {
  const execution = executions[0];
  const steps = execution?.steps?.filter((step) => step.review?.findingRecords?.some((finding) => finding.status === "outstanding")) ?? [];
  if (!execution || !steps.length) return null;
  return <section aria-label="Outstanding findings" className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Outstanding findings</h3>
    {steps.map((step) => {
      const attempt = step.review!.attempts.filter((item) => item.role === "review").at(-1);
      const artifacts = [...(attempt?.reviewedArtifacts ?? []), ...(attempt?.artifacts ?? [])].filter((ref, index, refs) => refs.findIndex((item) => item.revisionId === ref.revisionId) === index);
      return <div key={step.id} className="space-y-2">
      <HistoryPage label="findings" items={step.review!.findingRecords!.filter((finding) => finding.status === "outstanding")} render={(finding) => <Button key={finding.id} type="button" variant="link" className="h-auto max-w-full whitespace-normal text-left" onClick={() => onNavigate(findingRecordId(execution.id, step.id, finding.id))}>{finding.id}: {finding.body.slice(0, 160)}</Button>} />
      <HistoryGroup title="Relevant pinned artifacts"><HistoryPage label="artifacts" items={artifacts} render={(ref) => <CommentAttachments key={ref.revisionId} references={[ref]} />} /></HistoryGroup>
    </div>; })}
  </section>;
}

export function ReviewHistory({ executions, comments, selectedRecord, navigationVersion, onNavigate, onNavigateFeedback }: {
  executions: WorkflowExecution[]; comments: TaskComment[]; selectedRecord?: string; navigationVersion?: number;
  onNavigate: (id: string) => void; onNavigateFeedback: (id: string) => void;
}) {
  const isSelectedComment = (comment: TaskComment) => selectedRecord === `comment-${comment.id}`;
  const isSelectedRun = (runId: string) => selectedRecord === `review-run-${runId}` || comments.some((comment) => comment.runId === runId && isSelectedComment(comment));
  const isSelectedFinding = (executionId: string, stepId: string) => selectedRecord?.startsWith(findingRecordId(executionId, stepId, ""));
  const contains = (execution: WorkflowExecution) => execution.steps?.some((step) => isSelectedFinding(execution.id, step.id)) || execution.runs.some((run) => isSelectedRun(run.id)) || comments.some((comment) => comment.workflowExecutionId === execution.id && isSelectedComment(comment));
  return <section aria-label="Workflow activity" className="space-y-3">
    <h3 className="font-semibold">Workflow activity</h3>
    <HistoryPage label="executions" items={executions} targetIndex={executions.findIndex(contains)} render={(execution, index) => <HistoryGroup key={execution.id} initialOpen={index === 0} reveal={contains(execution) ? `${selectedRecord}:${navigationVersion}` : undefined} title={`${execution.workflow.name} · ${execution.status} · ${new Date(execution.createdAt).toLocaleString()}`}>
      {execution.steps?.map((step, stepIndex) => {
        const stepComments = comments.filter((comment) => comment.workflowExecutionId === execution.id && comment.stepId === step.id);
        const review = step.review;
        const rounds = review ? [...new Set(review.attempts.map((attempt) => attempt.round))].sort((a, b) => b - a) : [];
        const targetRound = review?.attempts.find((attempt) => isSelectedRun(attempt.runId))?.round;
        return <section key={step.id} aria-label={`Step ${stepIndex + 1} activity`} className="space-y-3">
          <h4 className="text-sm font-semibold">Step {stepIndex + 1} · {step.profile?.name ?? "Human checkpoint"}</h4>
          {review ? <>
            <HistoryGroup title={`Findings (${review.findingRecords?.filter((finding) => finding.status === "outstanding").length ?? 0} outstanding)`} reveal={isSelectedFinding(execution.id, step.id) ? `${selectedRecord}:${navigationVersion}` : undefined}>
              {!review.findingRecords?.length && <p className="text-sm text-muted-foreground">No tracked findings. Older review summaries remain available in their original rounds.</p>}
              <HistoryPage label="findings" items={review.findingRecords ?? []} targetIndex={review.findingRecords?.findIndex((finding) => selectedRecord === findingRecordId(execution.id, step.id, finding.id))} render={(finding) => <article key={finding.id} id={findingRecordId(execution.id, step.id, finding.id)} tabIndex={-1} className="space-y-2 rounded border p-3 text-sm">
                <p className="font-medium">{finding.id} · {finding.status}</p>
                <HistoryGroup title={finding.body.slice(0, 160)}><Markdown>{finding.body}</Markdown></HistoryGroup>
                <Button type="button" size="sm" variant="link" onClick={() => onNavigate(`review-run-${finding.introducedRunId}`)}>Original finding and evidence</Button>
                <HistoryGroup title="Reviewer verification history"><HistoryPage label="dispositions" items={[...finding.dispositions].reverse()} render={(disposition) => <div key={disposition.runId}><p>Round {disposition.round} · {disposition.status}</p><Markdown>{disposition.note}</Markdown><Button type="button" size="sm" variant="link" onClick={() => onNavigate(`review-run-${disposition.runId}`)}>View reviewer attempt</Button></div>} /></HistoryGroup>
              </article>} />
            </HistoryGroup>
            <HistoryPage label="rounds" items={rounds} targetIndex={rounds.indexOf(targetRound ?? -1)} render={(round, roundIndex) => <HistoryGroup key={round} title={`Round ${round}`} initialOpen={index === 0 && roundIndex === 0} reveal={round === targetRound ? `${selectedRecord}:${navigationVersion}` : undefined}>
              {review.attempts.filter((attempt) => attempt.round === round).map((attempt) => {
                const run = execution.runs.find((item) => item.id === attempt.runId);
                return <article key={attempt.runId} id={`review-run-${attempt.runId}`} tabIndex={-1} className="space-y-2 border-b pb-3 text-sm">
                  <h5 className="font-semibold">{attempt.role === "review" ? "Review" : "Revision"} · {attempt.outcome ?? run?.status}</h5>
                  {attempt.reviewedRunId ? <Button type="button" size="sm" variant="link" onClick={() => {
                    const source = comments.find((comment) => comment.runId === attempt.reviewedRunId && !comment.responseTo);
                    onNavigate(source ? `comment-${source.id}` : `review-run-${attempt.reviewedRunId}`);
                  }}>Reviewed attempt</Button> : attempt.role === "review" && <p>No preceding completed attempt.</p>}
                  <HistoryGroup title="Exact artifact revisions"><HistoryPage label="artifacts" items={[...(attempt.reviewedArtifacts ?? []), ...(attempt.artifacts ?? [])].filter((ref, i, refs) => refs.findIndex((item) => item.revisionId === ref.revisionId) === i)} render={(ref) => <CommentAttachments key={ref.revisionId} references={[ref]} />} /></HistoryGroup>
                  {!!attempt.findingUpdates?.length && <p>{attempt.findingUpdates.map((update) => `${update.id}: ${update.status}`).join(" · ")}</p>}
                  <HistoryGroup title="Full original content" reveal={stepComments.some((comment) => comment.runId === attempt.runId && isSelectedComment(comment)) ? `${selectedRecord}:${navigationVersion}` : undefined}>
                    <TaskActivity selectedCommentId={selectedRecord?.replace(/^comment-/, "")} comments={stepComments.filter((comment) => comment.runId === attempt.runId)} onNavigateFeedback={onNavigateFeedback} />
                    {!stepComments.some((comment) => comment.runId === attempt.runId) && <Markdown>{run?.summary ?? "No result yet."}</Markdown>}
                    <HistoryGroup title="Exact supplied prompt"><pre className="whitespace-pre-wrap break-words text-xs">{run?.prompt ?? "No prompt supplied."}</pre></HistoryGroup>
                  </HistoryGroup>
                </article>;
              })}
            </HistoryGroup>} />
            <TaskActivity selectedCommentId={selectedRecord?.replace(/^comment-/, "")} comments={stepComments.filter((comment) => !review.attempts.some((attempt) => attempt.runId === comment.runId))} onNavigateFeedback={onNavigateFeedback} />
          </> : <TaskActivity comments={stepComments} selectedCommentId={selectedRecord?.replace(/^comment-/, "")} onNavigateFeedback={onNavigateFeedback} />}
        </section>;
      })}
    </HistoryGroup>} />
  </section>;
}
